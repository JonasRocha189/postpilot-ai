from typing import Annotated, Any

from langchain.tools import ToolRuntime, tool

from ai.agent.context import AgentContext
from database.models import Network
from schemas.posts import CHAR_LIMIT

# What each network rewards, for the model to apply when it rewrites
TIPS: dict[Network, str] = {
    Network.LINKEDIN: (
        "Professional tone. A strong first line (it shows before 'see more'), short "
        "paragraphs, 3 to 5 hashtags at the end, a question or call to action."
    ),
    Network.INSTAGRAM: (
        "Caption for an image: hook in the first line, emojis are welcome, line breaks "
        "between ideas, up to 10 hashtags at the end, call to action."
    ),
    Network.X: (
        "One idea, direct and short. At most 1 or 2 hashtags, no long introductions. "
        "Every character counts."
    ),
}


def adapt_for_network_data(text: str, network: str) -> dict[str, Any]:
    """The network's limit and style, and whether the text fits (no AI involved)."""
    try:
        parsed = Network(network.lower())
    except ValueError:
        return {"error": "Unknown network. Use linkedin, instagram or x."}
    limit = CHAR_LIMIT[parsed]
    length = len(text.strip())
    return {
        "network": parsed.value,
        "max_characters": limit,
        "characters": length,
        "fits": length <= limit,
        "characters_over": max(0, length - limit),
        "style": TIPS[parsed],
    }


@tool
async def adapt_for_network(
    text: Annotated[str, "the post text to check"],
    network: Annotated[str, "linkedin, instagram or x"],
    runtime: ToolRuntime[AgentContext],
) -> dict[str, Any]:
    """Check a post text against a network's rules before saving it.

    Returns the network's character limit, the text's length, whether it fits and
    the style that works on that network. If it doesn't fit, shorten the text and
    check again; then save the adapted text with save_draft.
    """
    return adapt_for_network_data(text, network)
