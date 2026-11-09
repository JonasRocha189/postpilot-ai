"""Tools that don't need the database: adapt_for_network and search_web.

search_web talks to Tavily through a fake HTTP transport (no network).
"""

import json

import httpx
import pytest

from ai.tools.adapt_for_network import adapt_for_network_data
from ai.tools.search_web import search_web_data
from database.config import settings

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


# --- adapt_for_network --------------------------------------------------------


def test_a_text_that_fits() -> None:
    result = adapt_for_network_data("Post curto.", "linkedin")
    assert result["fits"] is True
    assert result["max_characters"] == 3000
    assert result["characters"] == len("Post curto.")
    assert "hashtags" in result["style"]


def test_a_text_too_long_for_x() -> None:
    result = adapt_for_network_data("a" * 300, "X")
    assert (result["fits"], result["characters_over"]) == (False, 20)


def test_an_unknown_network() -> None:
    assert "linkedin, instagram or x" in adapt_for_network_data("texto", "tiktok")["error"]


# --- search_web ---------------------------------------------------------------


def tavily(results: list[dict[str, str]], status: int = 200) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://api.tavily.com/search"
        assert request.headers["Authorization"] == "Bearer tvly-test"
        assert json.loads(request.content)["query"] == "tendências de cibersegurança"
        return httpx.Response(status, json={"results": results})

    return httpx.MockTransport(handler)


async def test_search_web_returns_results_with_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "tavily_api_key", "tvly-test")
    transport = tavily(
        [{"title": "Relatório 2026", "url": "https://example.com/r", "content": "x" * 900}]
    )

    results = await search_web_data("tendências de cibersegurança", transport)

    assert isinstance(results, list)
    assert results[0]["url"] == "https://example.com/r"
    assert len(results[0]["content"]) == 500


async def test_search_web_failure_lets_the_agent_continue(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "tavily_api_key", "tvly-test")

    result = await search_web_data("tendências de cibersegurança", tavily([], status=500))

    assert isinstance(result, dict)
    assert "Continue without it" in result["error"]


async def test_search_web_without_a_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "tavily_api_key", "")

    assert await search_web_data("qualquer") == {"error": "Web search is not configured."}
