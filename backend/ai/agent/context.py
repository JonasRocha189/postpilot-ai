"""What the backend hands to every tool of a run.

LangChain injects it into the tools' `runtime: ToolRuntime[AgentContext]`
parameter, which is left out of the schema the LLM sees: the model can't read,
choose or change the user or the project. They come from the token and from
the project the API already checked.
"""

import uuid
from dataclasses import dataclass

from langchain_core.embeddings import Embeddings
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


@dataclass(frozen=True)
class AgentContext:
    """The run's user, project and resources."""

    run_id: uuid.UUID
    user_id: str
    project_id: uuid.UUID
    # Each tool call opens its own short session
    sessions: async_sessionmaker[AsyncSession]
    embeddings: Embeddings
