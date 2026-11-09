"""Run the agent for one AgentRun, saving every step as it happens.

LangChain's `create_agent` (built on LangGraph) runs the loop: the model gets
the request and the tools, asks for tools, gets their results and repeats
until it answers. Middleware adds what PostPilot needs around it:

- ModelCallLimitMiddleware: at most `agent_max_iterations` model calls (8).
- ModelFallbackMiddleware: when the first model fails, the next one answers.
- StepRecorder: counts the iterations and writes each tool call to
  `agent_steps` (and the logs) as soon as it ends, so the screen polling the
  run shows the steps live.
"""

import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    ModelCallLimitMiddleware,
    ModelFallbackMiddleware,
    ModelRequest,
    ModelResponse,
    ToolCallRequest,
)
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import BaseTool
from langgraph.types import Command
from sqlalchemy import update

from ai.agent.context import AgentContext
from database.config import settings
from database.models import AgentMode, AgentRun, AgentStep, RunStatus

logger = logging.getLogger(__name__)

PROMPTS: dict[AgentMode, str] = {
    mode: (Path(__file__).parent / "prompts" / f"{mode.value}.md").read_text(encoding="utf-8")
    for mode in AgentMode
}
# A run that takes longer than this is stopped (a stuck provider, a loop)
RUN_TIMEOUT_SECONDS = 180
SUMMARY_LENGTH = 200


def summarize(content: Any) -> str:
    """A short, readable line for the screen; the full result stays in the database."""
    if isinstance(content, list):
        return f"{len(content)} result(s)"
    if isinstance(content, dict) and "error" in content:
        return str(content["error"])[:SUMMARY_LENGTH]
    text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
    return text if len(text) <= SUMMARY_LENGTH else f"{text[: SUMMARY_LENGTH - 1]}…"


def _parse(content: str | list[Any]) -> Any:
    """Tool results arrive as JSON text: store them as JSON when they are."""
    if isinstance(content, list):
        return content
    try:
        return json.loads(content)
    except ValueError:
        return content


class StepRecorder(AgentMiddleware):
    """Counts the model calls and saves every tool call of a run."""

    def __init__(self, ctx: AgentContext) -> None:
        """Record the steps of the run in `ctx`."""
        super().__init__()
        self.ctx = ctx
        self.model_calls = 0
        self.last_asked_for_tools = False
        self._step_number = 0

    async def awrap_model_call(
        self,
        request: ModelRequest[Any],
        handler: Callable[[ModelRequest[Any]], Awaitable[ModelResponse[Any]]],
    ) -> ModelResponse[Any]:
        """One iteration of the loop: count it and note whether it asked for tools."""
        response = await handler(request)
        self.model_calls += 1
        self.last_asked_for_tools = any(
            isinstance(message, AIMessage) and message.tool_calls for message in response.result
        )
        return response

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command[Any]]],
    ) -> ToolMessage | Command[Any]:
        """Run the tool, then save the step (with the error, if it failed)."""
        call = request.tool_call
        # Numbered when the call starts: tools asked together may finish in any order
        self._step_number += 1
        step = AgentStep(
            run_id=self.ctx.run_id,
            step_number=self._step_number,
            tool=call["name"],
            arguments=call["args"],
        )
        start = time.perf_counter()
        try:
            response = await handler(request)
        except Exception as exc:
            step.error = f"{type(exc).__name__}: {exc}"[:1000]
            raise
        else:
            if isinstance(response, ToolMessage):
                step.result = _parse(response.content)
                step.result_summary = summarize(step.result)
            return response
        finally:
            step.duration_ms = round((time.perf_counter() - start) * 1000)
            await self._save(step)

    async def _save(self, step: AgentStep) -> None:
        async with self.ctx.sessions() as db:
            db.add(step)
            await db.commit()
        # Name, arguments and duration only: never the full result
        logger.info(
            "agent step",
            extra={
                "run_id": str(self.ctx.run_id),
                "step": step.step_number,
                "tool": step.tool,
                "arguments": step.arguments,
                "duration_ms": step.duration_ms,
                "error": step.error,
            },
        )


async def run_agent(
    ctx: AgentContext,
    mode: AgentMode,
    request: str,
    models: Sequence[BaseChatModel],
    tools: Sequence[BaseTool],
) -> None:
    """Run the agent for the AgentRun `ctx.run_id` and save how it ended."""
    recorder = StepRecorder(ctx)
    middleware: list[AgentMiddleware[Any, Any, Any]] = [
        ModelCallLimitMiddleware(run_limit=settings.agent_max_iterations, exit_behavior="end")
    ]
    if len(models) > 1:
        middleware.append(ModelFallbackMiddleware(*models[1:]))
    middleware.append(recorder)
    agent = create_agent(
        models[0],
        tools,
        system_prompt=PROMPTS[mode],
        middleware=middleware,
        context_schema=AgentContext,
    )

    status, response = RunStatus.COMPLETED, None
    try:
        state = await asyncio.wait_for(
            agent.ainvoke(
                {"messages": [HumanMessage(request)]},
                context=ctx,
                # Shown in LangSmith (when tracing is on): find a run by its id
                config={"run_name": f"agent-run-{ctx.run_id}", "tags": [mode.value]},
            ),
            timeout=RUN_TIMEOUT_SECONDS,
        )
        if recorder.model_calls >= settings.agent_max_iterations and recorder.last_asked_for_tools:
            # Still asking for tools at the last allowed call: no final answer
            status = RunStatus.LIMIT_REACHED
            response = (
                f"I stopped after {settings.agent_max_iterations} steps without finishing. "
                "Try a more specific request."
            )
        else:
            response = state["messages"][-1].text
    except Exception:
        logger.exception("Agent run failed", extra={"run_id": str(ctx.run_id)})
        status = RunStatus.ERROR
        response = "Something went wrong while running the agent. Try again in a moment."

    async with ctx.sessions() as db:
        await db.execute(
            update(AgentRun)
            .where(AgentRun.id == ctx.run_id)
            .values(
                status=status,
                response=response,
                iterations=recorder.model_calls,
                finished_at=datetime.now(UTC),
            )
        )
        await db.commit()
    logger.info(
        "agent run finished",
        extra={
            "run_id": str(ctx.run_id),
            "status": status.value,
            "iterations": recorder.model_calls,
        },
    )
