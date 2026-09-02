"""Shared FastAPI dependencies: auth, pagination, cursors."""
from __future__ import annotations

import base64
from typing import Annotated

from fastapi import Depends, HTTPException, Query, WebSocket, WebSocketException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import ACCESS_TOKEN_TYPE, decode_token
from app.db.session import SessionFactory, get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[AsyncSession, Depends(get_db)]


def _credentials_exc() -> HTTPException:
    # Built fresh per call: a shared instance would accumulate __cause__/__traceback__
    # across concurrent requests.
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _user_from_token(token: str, db: AsyncSession) -> User:
    try:
        payload = decode_token(token, expected_type=ACCESS_TOKEN_TYPE)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError) as exc:
        raise _credentials_exc() from exc
    user = await db.get(User, user_id)
    if user is None:
        raise _credentials_exc()
    return user


async def get_current_user(
    db: DbDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if creds is None:
        raise _credentials_exc()
    return await _user_from_token(creds.credentials, db)


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_user_ws(websocket: WebSocket) -> User:
    """WebSocket auth — token comes as a query param (`?token=`; browsers can't set
    headers on the WS handshake). Raising WebSocketException lets Starlette close the
    socket cleanly, with no double-close."""
    token = websocket.query_params.get("token")
    if not token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    async with SessionFactory() as db:
        try:
            return await _user_from_token(token, db)
        except HTTPException:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION) from None


# ---- pagination / cursor helpers -------------------------------------------

class PageParams:
    def __init__(
        self,
        limit: Annotated[int, Query(ge=1, le=50)] = 20,
        cursor: Annotated[str | None, Query()] = None,
    ) -> None:
        self.limit = limit
        self.cursor: int | None = decode_cursor(cursor) if cursor else None


PageDep = Annotated[PageParams, Depends(PageParams)]

_SEP = "\x1f"


def encode_cursor(item_id: int) -> str:
    """Keyset cursor over the primary key. Autoincrement ids are monotonic and
    correlate with creation order, so this is a stable, dialect-agnostic pagination
    key — unlike a datetime, which SQLite stores as text in an inconsistent format."""
    return _b64(str(item_id))


def decode_cursor(cursor: str) -> int:
    try:
        return int(_unb64(cursor))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor") from exc


def encode_str_cursor(text: str, item_id: int) -> str:
    return _b64(f"{text}{_SEP}{item_id}")


def decode_str_cursor(cursor: str) -> tuple[str, int]:
    try:
        text, _, item_id = _unb64(cursor).rpartition(_SEP)
        return text, int(item_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid cursor") from exc


def _b64(raw: str) -> str:
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _unb64(cursor: str) -> str:
    return base64.urlsafe_b64decode(cursor.encode()).decode()
