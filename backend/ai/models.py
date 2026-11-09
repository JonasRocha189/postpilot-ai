"""LangChain models created from the settings (decision 34).

The rest of the code depends only on LangChain's interfaces (`Embeddings`,
`BaseChatModel`); the concrete providers are created only here.
Tests replace them with LangChain's fake models.
"""

import base64
import ssl
from collections.abc import Awaitable, Callable
from functools import lru_cache
from typing import Literal

import httpx
import truststore
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from openai import AsyncOpenAI, DefaultAsyncHttpx2Client
from pydantic import SecretStr

from database.config import settings

ImageSize = Literal["1024x1024", "1024x1536", "1536x1024"]
# (prompt, size) -> the bytes of a PNG image. Tests pass a fake one.
# A Callable (not a Protocol) because LangChain validates the agent context with Pydantic.
ImageGenerator = Callable[[str, ImageSize], Awaitable[bytes]]


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


@lru_cache
def get_image_generator() -> ImageGenerator:
    """Image generation on OpenAI (gpt-image models always answer in base64)."""
    if not settings.openai_api_key:
        raise AIConfigError("OPENAI_API_KEY is not set")
    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        max_retries=1,
        # An image takes from 10 to 60 seconds
        http_client=DefaultAsyncHttpx2Client(verify=_ssl_context(), timeout=120),
    )

    async def generate(prompt: str, size: ImageSize) -> bytes:
        response = await client.images.generate(
            model=settings.image_model,
            prompt=prompt,
            size=size,
            quality=settings.image_quality,
            n=1,
        )
        data = response.data[0].b64_json if response.data else None
        if not data:
            raise RuntimeError("The image API returned no image")
        return base64.b64decode(data)

    return generate
