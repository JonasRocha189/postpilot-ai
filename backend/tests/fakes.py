"""Fake AI models for the tests: deterministic and without network."""

import hashlib

from langchain_core.embeddings import Embeddings


class FakeEmbeddings(Embeddings):
    """Vectors derived from a hash of the text: the same text, the same vector.

    LangChain's DeterministicFakeEmbedding needs numpy, which the app doesn't use.
    """

    def __init__(self, size: int) -> None:
        """Vectors with `size` dimensions (the configured embedding size)."""
        self.size = size

    def embed_query(self, text: str) -> list[float]:
        """One vector."""
        digest = hashlib.sha256(text.encode()).digest()
        return [digest[n % len(digest)] / 255 for n in range(self.size)]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """One vector per text."""
        return [self.embed_query(text) for text in texts]
