"""Shared test setup.

pytest loads this file before any test module, so `database.config.settings`
is built from these values and not from the developer's `.env`.
"""

import os

os.environ.setdefault("TC_HOST", "127.0.0.1")

# Environment variables win over the .env file in pydantic-settings
os.environ["AUTH0_DOMAIN"] = "test-tenant.auth0.com"
os.environ["AUTH0_AUDIENCE"] = "https://api.postpilot.test"
os.environ["AUTH_DEV_USER"] = ""


# AI off by default: no test may depend on (or spend) the developer's real keys
os.environ["OPENAI_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""
os.environ["TAVILY_API_KEY"] = ""
os.environ["LANGSMITH_TRACING"] = "false"
