from typing import Annotated, Any

from langchain.tools import ToolRuntime, tool

from ai.agent.context import AgentContext
from ai.rag.search import search_chunks


async def search_documents_data(ctx: AgentContext, query: str) -> list[dict[str, Any]]:
    """The most relevant passages of the project's documents (hybrid search)."""
    async with ctx.sessions() as db:
        results = await search_chunks(db, ctx.embeddings, ctx.user_id, ctx.project_id, query)
    return [{"document": result.document_name, "content": result.content} for result in results]


@tool
async def search_documents(
    query: Annotated[str, "what to look for, in natural language or keywords"],
    runtime: ToolRuntime[AgentContext],
) -> list[dict[str, Any]]:
    """Search the documents uploaded to the current project.

    Returns the most relevant passages of the briefings, manuals and reports, with
    the document name. Use it to base the post on facts from the client's material.
    An empty list means nothing relevant was found.
    """
    return await search_documents_data(runtime.context, query)
