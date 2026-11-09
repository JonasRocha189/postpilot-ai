"""The tools the agent can call, per mode. Each one lives in its own file."""

from langchain_core.tools import BaseTool

from ai.tools.adapt_for_network import adapt_for_network
from ai.tools.analyze_performance import analyze_performance
from ai.tools.generate_image import generate_image
from ai.tools.get_project import get_project
from ai.tools.get_subject import get_subject
from ai.tools.list_subjects import list_subjects
from ai.tools.save_draft import save_draft
from ai.tools.search_documents import search_documents
from ai.tools.search_past_posts import search_past_posts
from ai.tools.search_web import search_web
from database.models import AgentMode

# Read only: they never change data
READ_TOOLS: list[BaseTool] = [
    get_project,
    list_subjects,
    get_subject,
    search_documents,
    search_past_posts,
    search_web,
    analyze_performance,
]

TOOLS_BY_MODE: dict[AgentMode, list[BaseTool]] = {
    # Ideation suggests topics: it reads, but never writes
    AgentMode.IDEATION: READ_TOOLS,
    # Creation writes the post and saves it (always as a draft)
    AgentMode.CREATION: [*READ_TOOLS, adapt_for_network, generate_image, save_draft],
}

ALL_TOOLS: list[BaseTool] = TOOLS_BY_MODE[AgentMode.CREATION]
