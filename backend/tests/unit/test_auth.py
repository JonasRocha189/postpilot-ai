from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from api import deps
from api.deps import get_current_user_id
from database.config import settings

USER = "auth0|user-123"


# --- Keys and tokens ---------------------------------------------------------


@pytest.fixture(scope="module")
def auth0_key() -> rsa.RSAPrivateKey:
    """Plays the role of Auth0's private key (generated once per module: it's slow)."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="module")
def other_key() -> rsa.RSAPrivateKey:
    """A key that is NOT Auth0's: tokens signed with it must be rejected."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def make_token(key: rsa.RSAPrivateKey, **overrides: Any) -> str:
    """A token like Auth0's; `overrides` change or add claims (None removes one)."""
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": USER,
        "iss": settings.auth0_issuer,
        "aud": settings.auth0_audience,
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    claims.update(overrides)
    claims = {name: value for name, value in claims.items() if value is not None}
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test-key"})


class FakeJWKClient:
    """Replaces PyJWKClient: returns our public key, or raises `error`. No network."""

    def __init__(self, public_key: rsa.RSAPublicKey, error: Exception | None = None) -> None:
        self.public_key = public_key
        self.error = error

    def get_signing_key_from_jwt(self, token: str) -> SimpleNamespace:
        if self.error:
            raise self.error
        return SimpleNamespace(key=self.public_key)


@pytest.fixture
def jwks(monkeypatch: pytest.MonkeyPatch, auth0_key: rsa.RSAPrivateKey) -> FakeJWKClient:
    """Make the backend read "Auth0's" public key from the fake client."""
    fake = FakeJWKClient(auth0_key.public_key())
    monkeypatch.setattr(deps, "jwks_client", lambda: fake)
    return fake


# --- A tiny app that only uses the dependency under test ----------------------


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()

    @app.get("/me")
    async def me(user_id: str = Depends(get_current_user_id)) -> dict[str, str]:
        return {"user_id": user_id}

    return TestClient(app)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --- Tests --------------------------------------------------------------------


def test_valid_token_returns_the_auth0_user_id(
    client: TestClient, jwks: FakeJWKClient, auth0_key: rsa.RSAPrivateKey
) -> None:
    response = client.get("/me", headers=bearer(make_token(auth0_key)))

    assert response.status_code == 200
    assert response.json() == {"user_id": USER}


def test_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_without_token_uses_the_dev_user_when_configured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "auth_dev_user", "dev-user")

    response = client.get("/me")

    assert response.json() == {"user_id": "dev-user"}


@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"exp": datetime.now(UTC) - timedelta(minutes=1)}, id="expired"),
        pytest.param({"aud": "https://another-api.example"}, id="wrong-audience"),
        pytest.param({"iss": "https://another-tenant.auth0.com/"}, id="wrong-issuer"),
        pytest.param({"sub": None}, id="missing-sub"),
    ],
)
def test_invalid_claims_return_401(
    client: TestClient,
    jwks: FakeJWKClient,
    auth0_key: rsa.RSAPrivateKey,
    overrides: dict[str, Any],
) -> None:
    response = client.get("/me", headers=bearer(make_token(auth0_key, **overrides)))

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid token"}


def test_token_signed_by_another_key_returns_401(
    client: TestClient, jwks: FakeJWKClient, other_key: rsa.RSAPrivateKey
) -> None:
    response = client.get("/me", headers=bearer(make_token(other_key)))

    assert response.status_code == 401


def test_unsigned_token_is_rejected(client: TestClient, jwks: FakeJWKClient) -> None:
    # Classic attack: "alg": "none" and no signature
    token = jwt.encode({"sub": USER}, "", algorithm="none", headers={"kid": "test-key"})

    response = client.get("/me", headers=bearer(token))

    assert response.status_code == 401


def test_garbage_token_returns_401(client: TestClient, jwks: FakeJWKClient) -> None:
    response = client.get("/me", headers=bearer("not-a-jwt"))

    assert response.status_code == 401


def test_auth0_unreachable_returns_503(
    client: TestClient, jwks: FakeJWKClient, auth0_key: rsa.RSAPrivateKey
) -> None:
    jwks.error = jwt.PyJWKClientConnectionError("connection refused")

    response = client.get("/me", headers=bearer(make_token(auth0_key)))

    assert response.status_code == 503
    assert response.json() == {"detail": "Authentication provider unavailable"}
