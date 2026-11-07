# syntax=docker/dockerfile:1

# --- Build: install the locked dependencies into /app/.venv ------------------
FROM python:3.12-slim AS build
# uv from its official image (same version as local development)
COPY --from=ghcr.io/astral-sh/uv:0.11.1 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app

# Dependencies first: this layer stays cached until uv.lock changes
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# Then the code (what goes in is filtered by .dockerignore)
COPY . .

# --- Runtime: only Python, the venv and the code (no uv, no build tools) ----
FROM python:3.12-slim
WORKDIR /app

# Never run as root inside the container
RUN useradd --create-home --uid 10001 app
COPY --from=build --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PORT=8000
USER app
EXPOSE 8000

# Migrations, then the API. Render sets $PORT; exec makes uvicorn PID 1
# (receives SIGTERM on deploys). Proxy headers: Vercel and Render are in front.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
