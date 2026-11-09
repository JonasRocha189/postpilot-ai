"""The tools the agent can call. Each one lives in its own file."""

from langchain_core.tools import BaseTool

from ai.tools.get_project import get_project
from ai.tools.get_subject import get_subject
from ai.tools.list_subjects import list_subjects
from ai.tools.search_documents import search_documents
from ai.tools.search_past_posts import search_past_posts

# Read only: they never change data
READ_TOOLS: list[BaseTool] = [
    get_project,
    list_subjects,
    get_subject,
    search_documents,
    search_past_posts,
]
