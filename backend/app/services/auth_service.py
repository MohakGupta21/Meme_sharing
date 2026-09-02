"""Signup / login / refresh-token rotation."""
from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import RefreshToken, User
from app.schemas.auth import SignupForm


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def _issue_pair(db: AsyncSession, user: User) -> tuple[str, str]:
    access = create_access_token(user.id)
    refresh, jti, expires_at = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id, jti=jti, token_hash=_hash_token(refresh), expires_at=expires_at
        )
    )
    await db.flush()
    return access, refresh


async def signup(
    db: AsyncSession, form: SignupForm, profile_picture_url: str
) -> tuple[User, str, str]:
    user = User(
        email=form.email.lower(),
        username=form.username,
        password_hash=hash_password(form.password),
        display_name=form.display_name,
        profile_picture_url=profile_picture_url,
        lives_in=form.lives_in,
        caption=form.caption,
        bio=form.bio,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email or username already in use"
        ) from exc
    access, refresh = await _issue_pair(db, user)
    await db.commit()
    await db.refresh(user)
    return user, access, refresh


async def login(db: AsyncSession, identifier: str, password: str) -> tuple[str, str]:
    ident = identifier.strip()
    result = await db.execute(
        select(User).where(or_(User.email == ident.lower(), User.username == ident))
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access, refresh = await _issue_pair(db, user)
    await db.commit()
    return access, refresh


async def refresh_access(db: AsyncSession, refresh_token: str) -> tuple[str, str]:
    """Validate + rotate: old refresh token is revoked, a fresh pair is returned."""
    try:
        payload = decode_token(refresh_token, expected_type=REFRESH_TOKEN_TYPE)
        jti = payload["jti"]
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    ).scalar_one_or_none()
    if (
        row is None
        or row.revoked
        or row.token_hash != _hash_token(refresh_token)
        or row.expires_at < datetime.now(UTC).replace(tzinfo=None)
    ):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    row.revoked = True
    access, new_refresh = await _issue_pair(db, user)
    await db.commit()
    return access, new_refresh


async def logout(db: AsyncSession, refresh_token: str) -> None:
    try:
        payload = decode_token(refresh_token, expected_type=REFRESH_TOKEN_TYPE)
        jti = payload["jti"]
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail="Invalid refresh token") from exc
    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    ).scalar_one_or_none()
    if row is not None:
        row.revoked = True
        await db.commit()
