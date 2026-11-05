import asyncio
import ssl
from functools import lru_cache
from typing import Any

import jwt
import truststore
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database.config import settings

# auto_error=False: without a token we decide what happens (dev user or 401)
bearer = HTTPBearer(auto_error=False)


def decode_token(token: str) -> dict[str, Any]:
    """Validate the token's signature, issuer, audience and expiry; return its claims."""
    signing_key = jwks_client().get_signing_key_from_jwt(token)
    claims: dict[str, Any] = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],  # fixed: never trust the "alg" written in the token
        audience=settings.auth0_audience,
        issuer=settings.auth0_issuer,
        options={"require": ["exp", "iss", "aud", "sub"]},
    )
    return claims


def unauthorized(detail: str) -> HTTPException:
    """401 with the header that tells the client to send a Bearer token."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    """Return the Auth0 user id (the token's `sub`).

    Without a token: the dev user locally (AUTH_DEV_USER), otherwise 401.
    """
    if credentials is None:
        if settings.auth_dev_user:
            return settings.auth_dev_user
        raise unauthorized("Not authenticated")

    try:
        # The first call downloads the keys with blocking HTTP: keep it off the event loop
        claims = await asyncio.to_thread(decode_token, credentials.credentials)
    except jwt.PyJWKClientConnectionError as exc:
        # Auth0 unreachable: not the user's fault
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication provider unavailable",
        ) from exc
    except (jwt.InvalidTokenError, jwt.PyJWKClientError) as exc:
        # Expired, wrong audience/issuer, bad signature, unknown key...
        raise unauthorized("Invalid token") from exc

    return str(claims["sub"])


@lru_cache
def jwks_client() -> jwt.PyJWKClient:
    """Client that downloads Auth0's public signing keys and caches them."""
    # Verify TLS with the OS trust store (works behind antivirus/corporate HTTPS inspection)
    context = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    return jwt.PyJWKClient(f"{settings.auth0_issuer}.well-known/jwks.json", ssl_context=context)
