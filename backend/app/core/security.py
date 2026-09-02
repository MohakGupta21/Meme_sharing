"""Password hashing and JWT encode/decode."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

# bcrypt only considers the first 72 bytes of the password and (in 4.x) raises if
# handed anything longer, so truncate defensively.
_BCRYPT_MAX = 72


def _prep(raw: str) -> bytes:
    return raw.encode("utf-8")[:_BCRYPT_MAX]


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(_prep(raw), bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prep(raw), hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(subject: str | int, token_type: str, ttl: timedelta) -> tuple[str, str]:
    settings = get_settings()
    now = datetime.now(UTC)
    jti = uuid.uuid4().hex
    claims: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    token = jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    token, _ = _create_token(
        user_id, ACCESS_TOKEN_TYPE, timedelta(minutes=settings.access_token_ttl_minutes)
    )
    return token


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """Return (token, jti, expires_at). expires_at is naive UTC so it round-trips
    through both SQLite and Postgres datetime columns without tz-comparison errors."""
    settings = get_settings()
    ttl = timedelta(days=settings.refresh_token_ttl_days)
    token, jti = _create_token(user_id, REFRESH_TOKEN_TYPE, ttl)
    expires_at = (datetime.now(UTC) + ttl).replace(tzinfo=None)
    return token, jti, expires_at


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:  # expired, bad signature, malformed
        raise ValueError("invalid token") from exc
    if expected_type and payload.get("type") != expected_type:
        raise ValueError("wrong token type")
    return payload
