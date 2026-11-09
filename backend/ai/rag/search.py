"""Hybrid search over a project's documents: vector + full-text, merged with RRF.

- Vector: cosine distance between the query's embedding and each chunk's
  (finds passages with the same meaning, even in other words).
- Full-text: Postgres `tsvector` in Portuguese (finds the exact terms, names
  and codes that embeddings tend to blur).
- Reciprocal Rank Fusion merges the two rankings using only the positions,
  so the scores of the two methods (not comparable) never need to be mixed.

Every query is limited to the user's project and to documents that are ready.
"""

import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass

from langchain_core.embeddings import Embeddings
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Chunk, Document, DocumentStatus

# Usual RRF constant: the top positions count more, but not overwhelmingly
RRF_K = 60
# How many chunks each method brings before the fusion
CANDIDATES = 20


@dataclass(frozen=True)
class SearchResult:
    """A chunk found by the search, with where it came from."""

    chunk_id: uuid.UUID
    document_name: str
    content: str
    score: float


def reciprocal_rank_fusion(
    *rankings: Sequence[uuid.UUID], k: int = RRF_K
) -> list[tuple[uuid.UUID, float]]:
    """Merge rankings: each item scores 1 / (k + position) in every ranking it is in."""
    scores: dict[uuid.UUID, float] = defaultdict(float)
    for ranking in rankings:
        for position, item in enumerate(ranking, start=1):
            scores[item] += 1 / (k + position)
    return sorted(scores.items(), key=lambda pair: pair[1], reverse=True)


def _project_chunks(user_id: str, project_id: uuid.UUID) -> Select[uuid.UUID]:
    """Ids of the chunks the search may return: this user's project, ready documents."""
    return (
        select(Chunk.id)
        .join(Document, Chunk.document_id == Document.id)
        .where(
            Document.user_id == user_id,
            Document.project_id == project_id,
            Document.status == DocumentStatus.READY,
        )
    )


async def search_chunks(
    db: AsyncSession,
    embeddings: Embeddings,
    user_id: str,
    project_id: uuid.UUID,
    query: str,
    limit: int = 5,
) -> list[SearchResult]:
    """The `limit` most relevant chunks of the project's documents for `query`."""
    query_vector = await embeddings.aembed_query(query)
    by_meaning = (
        _project_chunks(user_id, project_id)
        .order_by(Chunk.embedding.cosine_distance(query_vector))
        .limit(CANDIDATES)
    )
    # websearch_to_tsquery accepts free text (quotes, "or", -word) without syntax errors
    terms = func.websearch_to_tsquery("portuguese", query)
    by_terms = (
        _project_chunks(user_id, project_id)
        .where(Chunk.search_vector.op("@@")(terms))
        .order_by(func.ts_rank(Chunk.search_vector, terms).desc())
        .limit(CANDIDATES)
    )
    meaning_ids = list(await db.scalars(by_meaning))
    terms_ids = list(await db.scalars(by_terms))

    best = reciprocal_rank_fusion(meaning_ids, terms_ids)[:limit]
    if not best:
        return []
    rows = await db.execute(
        select(Chunk.id, Chunk.content, Document.name)
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.id.in_([chunk_id for chunk_id, _ in best]))
    )
    found = {row.id: row for row in rows}
    return [
        SearchResult(
            chunk_id=chunk_id,
            document_name=found[chunk_id].name,
            content=found[chunk_id].content,
            score=score,
        )
        for chunk_id, score in best
    ]
