"""Logs as an event stream (12-factor): one JSON object per line on stdout.

structlog formats the app's logs; the standard `logging` loggers (uvicorn,
alembic, `logging.getLogger(__name__)` in the routers) go through the same
formatter, so every line has the same shape. Values bound with
`structlog.contextvars` (request_id, user_id) are added to every line.
"""

import logging
import sys

import structlog
from structlog.typing import EventDict, Processor, WrappedLogger

# Added to every line, from structlog and from the standard loggers alike
_SHARED: list[Processor] = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.add_log_level,
    structlog.stdlib.add_logger_name,
    structlog.processors.TimeStamper(fmt="iso", utc=True),
]


def _drop_color_message(_: WrappedLogger, __: str, event_dict: EventDict) -> EventDict:
    """Uvicorn adds a copy of the message with terminal colors: not useful in JSON."""
    event_dict.pop("color_message", None)
    return event_dict


def configure_logging(level: str = "INFO", json: bool = True) -> None:
    """Send every log to stdout: JSON in production, readable colors locally."""
    renderer: Processor = (
        structlog.processors.JSONRenderer() if json else structlog.dev.ConsoleRenderer()
    )
    structlog.configure(
        processors=[*_SHARED, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    formatter = structlog.stdlib.ProcessorFormatter(
        # Standard loggers: same fields, plus the `extra={...}` they pass
        foreign_pre_chain=[*_SHARED, structlog.stdlib.ExtraAdder(), _drop_color_message],
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.format_exc_info,
            renderer,
        ],
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    # uvicorn and alembic configure their own handlers: send them to the root one
    for name in ("uvicorn", "uvicorn.error", "alembic"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True
    # uvicorn's access log is replaced by the request log (with request_id and user_id)
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.access").propagate = False
