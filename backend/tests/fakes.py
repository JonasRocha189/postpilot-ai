"""Fake AI models for the tests: deterministic and without network."""

import hashlib
import itertools
from collections.abc import Sequence
from typing import Any

from langchain_core.embeddings import Embeddings
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage


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


class ScriptedChatModel(GenericFakeChatModel):
    """A chat model that answers with a fixed list of messages, in order.

    LangChain's GenericFakeChatModel can't receive tools (`bind_tools`), which
    the agent needs; this one accepts them and ignores them.
    """

    def bind_tools(self, tools: Sequence[Any], **kwargs: Any) -> "ScriptedChatModel":
        """Accept the agent's tools (the script already says what to call)."""
        return self


def scripted(*messages: AIMessage) -> ScriptedChatModel:
    """A scripted model that answers `messages`, one per call."""
    return ScriptedChatModel(messages=iter(messages))


def calls(*tool_calls: tuple[str, dict[str, Any]]) -> AIMessage:
    """A model answer that asks for these tools (name, arguments)."""
    ids = itertools.count(1)
    return AIMessage(
        content="",
        tool_calls=[
            {"name": name, "args": args, "id": f"call-{next(ids)}"} for name, args in tool_calls
        ],
    )


class BrokenChatModel(ScriptedChatModel):
    """A model whose every call fails, like a provider that is down."""

    def _generate(self, *args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("provider is down")

    async def _agenerate(self, *args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("provider is down")
