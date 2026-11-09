import ssl
from typing import Annotated, Any

import httpx
import truststore
from langchain.tools import ToolRuntime, tool

from ai.agent.context import AgentContext
from database.config import settings

TAVILY_URL = "https://api.tavily.com/search"
MAX_RESULTS = 5
# Each result's text is cut: enough to judge, without filling the prompt
SNIPPET_LENGTH = 500


async def search_web_data(
    query: str, transport: httpx.AsyncBaseTransport | None = None
) -> list[dict[str, Any]] | dict[str, str]:
    """Search the web with Tavily; every result comes with its source URL."""
    if not settings.tavily_api_key:
        return {"error": "Web search is not configured."}
    # OS trust store (antivirus HTTPS inspection); tests pass a fake transport
    verify = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    async with httpx.AsyncClient(transport=transport, verify=verify, timeout=20) as client:
        try:
            response = await client.post(
                TAVILY_URL,
                headers={"Authorization": f"Bearer {settings.tavily_api_key}"},
                json={"query": query, "max_results": MAX_RESULTS, "search_depth": "basic"},
            )
            response.raise_for_status()
        except httpx.HTTPError:
            return {"error": "Web search is unavailable right now. Continue without it."}
    return [
        {
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "content": str(item.get("content", ""))[:SNIPPET_LENGTH],
        }
        for item in response.json().get("results", [])
    ]


@tool
async def search_web(
    query: Annotated[str, "what to search for, like in a search engine"],
    runtime: ToolRuntime[AgentContext],
) -> list[dict[str, Any]] | dict[str, str]:
    """Search the web for recent news, trends and facts.

    Returns up to 5 results with title, URL and an excerpt. Always cite the URLs
    of the results you use.
    """
    return await search_web_data(query)
