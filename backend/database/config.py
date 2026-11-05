from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from environment variables or the `.env` file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql+asyncpg://postpilot:postpilot@localhost:5433/postpilot"
    database_echo: bool = False
    # Browser origins allowed to call the API (JSON list in the env var).
    # In production the frontend is served from the same origin, so this can stay empty.
    cors_origins: list[str] = ["http://localhost:5173"]

    # S3 (images and documents). Locally: LocalStack from docker-compose.yaml.
    # In production leave s3_endpoint_url empty to use AWS, and set the real bucket.
    s3_bucket: str = "postpilot-dev"
    s3_region: str = "us-east-1"
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None

    # Auth0: tenant domain (no https://, no trailing /) and the API identifier (token "aud").
    auth0_domain: str = ""
    auth0_audience: str = ""
    # Local only: user id used when a request has no token. Leave empty in production.
    auth_dev_user: str = ""

    @model_validator(mode="after")
    def require_auth(self) -> "Settings":
        """Refuse to start without Auth0 unless a dev user is set explicitly."""
        if not (self.auth0_domain and self.auth0_audience) and not self.auth_dev_user:
            raise ValueError("Set AUTH0_DOMAIN and AUTH0_AUDIENCE (or AUTH_DEV_USER locally)")
        return self

    @property
    def auth0_issuer(self) -> str:
        """Issuer claim Auth0 puts in its tokens (with the trailing slash)."""
        return f"https://{self.auth0_domain}/"


settings = Settings()
