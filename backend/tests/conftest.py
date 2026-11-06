"""Shared test setup.

pytest loads this file before any test module, so `database.config.settings`
is built from these values and not from the developer's `.env`.
"""

import os

# Environment variables win over the .env file in pydantic-settings
os.environ["AUTH0_DOMAIN"] = "test-tenant.auth0.com"
os.environ["AUTH0_AUDIENCE"] = "https://api.postpilot.test"
os.environ["AUTH_DEV_USER"] = ""
