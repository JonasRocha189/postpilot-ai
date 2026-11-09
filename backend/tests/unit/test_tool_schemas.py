"""What the LLM sees of each tool: never the user, the project or the runtime."""

from typing import Any

import pytest
from langchain_core.tools import BaseTool
from langchain_core.utils.function_calling import convert_to_openai_tool

from ai.tools.registry import ALL_TOOLS, TOOLS_BY_MODE
from database.models import AgentMode

HIDDEN = {"runtime", "ctx", "user_id", "project_id", "sessions", "embeddings"}


def seen_by_the_llm(tool: BaseTool) -> dict[str, Any]:
    """The tool definition as it is sent to the model (OpenAI format)."""
    function: dict[str, Any] = convert_to_openai_tool(tool)["function"]
    return function


@pytest.mark.parametrize("tool", ALL_TOOLS, ids=lambda tool: tool.name)
def test_the_llm_never_sees_who_or_which_project(tool: BaseTool) -> None:
    properties = seen_by_the_llm(tool)["parameters"].get("properties", {})
    assert HIDDEN.isdisjoint(properties)
    assert "runtime" not in seen_by_the_llm(tool)["description"]


@pytest.mark.parametrize("tool", ALL_TOOLS, ids=lambda tool: tool.name)
def test_every_tool_explains_itself(tool: BaseTool) -> None:
    assert len(tool.description) > 40


def test_the_arguments_the_llm_fills_in() -> None:
    arguments = {
        tool.name: sorted(seen_by_the_llm(tool)["parameters"].get("properties", {}))
        for tool in ALL_TOOLS
    }
    assert arguments == {
        "get_project": [],
        "list_subjects": [],
        "get_subject": ["subject_id"],
        "search_documents": ["query"],
        "search_past_posts": ["subject_id"],
        "search_web": ["query"],
        "adapt_for_network": ["network", "text"],
        "save_draft": ["subject_id", "title", "variations"],
    }


def test_ideation_never_writes() -> None:
    names = {tool.name for tool in TOOLS_BY_MODE[AgentMode.IDEATION]}
    assert names.isdisjoint({"save_draft", "adapt_for_network"})
    assert "save_draft" in {tool.name for tool in TOOLS_BY_MODE[AgentMode.CREATION]}
