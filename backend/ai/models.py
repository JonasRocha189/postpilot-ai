"""LangChain models created from the settings (decision 34).

The rest of the code depends only on LangChain's interfaces (`Embeddings`,
`BaseChatModel`); the concrete providers are created only here.
Tests replace them with LangChain's fake models.
"""

import ssl
from functools import lru_cache

import httpx
import truststore
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import SecretStr

from database.config import settings


class AIConfigError(RuntimeError):
    """An AI feature was used, but its API key is not configured."""


def _ssl_context() -> ssl.SSLContext:
    # OS trust store, as in api/deps.py: works behind antivirus HTTPS inspection
    return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


@lru_cache
def get_embeddings() -> Embeddings:
    """Embedding model for chunks and search queries (one instance per process)."""
    if not settings.openai_api_key:
        raise AIConfigError("OPENAI_API_KEY is not set")
    context = _ssl_context()
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        dimensions=settings.embedding_dimensions,
        openai_api_key=SecretStr(settings.openai_api_key),
        http_client=httpx.Client(verify=context),
        http_async_client=httpx.AsyncClient(verify=context),
    )


@lru_cache
def get_chat_models() -> tuple[BaseChatModel, ...]:
    """The agent's chat models, in order: OpenAI, then Groq as the fallback.

    The agent calls the first one; the next ones are used only when a call fails
    (outage, rate limit). Either key alone is enough; with neither, the AI is off.
    """
    context = _ssl_context()
    models: list[BaseChatModel] = []
    if settings.openai_api_key:
        models.append(
            ChatOpenAI(
                model_name=settings.chat_model,
                openai_api_key=SecretStr(settings.openai_api_key),
                max_retries=2,
                http_client=httpx.Client(verify=context),
                http_async_client=httpx.AsyncClient(verify=context),
            )
        )
    if settings.groq_api_key:
        models.append(
            ChatGroq(
                model_name=settings.fallback_chat_model,
                groq_api_key=SecretStr(settings.groq_api_key),
                max_retries=2,
                http_client=httpx.Client(verify=context),
                http_async_client=httpx.AsyncClient(verify=context),
            )
        )
    if not models:
        raise AIConfigError("Set OPENAI_API_KEY or GROQ_API_KEY")
    return tuple(models)
