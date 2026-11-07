import re
import time
import uuid

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = structlog.get_logger("api.request")

# A request id sent by the client (or a proxy) is reused only if it looks like an id
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
# Health checks run every few seconds: logged at debug, not info
_QUIET_PATHS = ("/api/v1/health",)


class RequestLogMiddleware:
    """Give each request a request_id and write one log line when it ends.

    Plain ASGI (not BaseHTTPMiddleware) on purpose: the app runs in the same
    context, so the user_id bound by the auth dependency shows up in this line.
    The id goes back in the `X-Request-ID` header, so a user can report it.
    """

    def __init__(self, app: ASGIApp) -> None:
        """Wrap the ASGI app."""
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle one ASGI call (only HTTP requests are logged)."""
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        sent = dict(scope["headers"]).get(b"x-request-id", b"").decode("latin-1")
        request_id = sent if _VALID_REQUEST_ID.match(sent) else uuid.uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        status = 500  # stays 500 if the app raises before answering
        start = time.perf_counter()

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            # Path only: the query string is not logged
            log = logger.debug if scope["path"].startswith(_QUIET_PATHS) else logger.info
            log(
                "request",
                method=scope["method"],
                path=scope["path"],
                status=status,
                duration_ms=round((time.perf_counter() - start) * 1000, 1),
            )
