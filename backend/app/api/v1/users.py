from __future__ import annotations

import uuid

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select, tuple_

from app.core.config import get_settings
from app.core.deps import CurrentUser, DbDep, decode_str_cursor, encode_str_cursor
from app.models import Friendship, FriendshipStatus, Meme, User
from app.schemas.common import Page
from app.schemas.user import UserMe, UserPublic, UserUpdate, UserWithRelation
from app.services import friend_service, meme_service
from app.storage import aio as storage

router = APIRouter(prefix="/users", tags=["users"])

_REQUIRED_PROFILE_FIELDS = {"lives_in", "caption"}


async def _counts(db, user_id: int) -> tuple[int, int]:
    meme_count = (
        await db.execute(select(func.count()).select_from(Meme).where(Meme.author_id == user_id))
    ).scalar_one()
    friend_count = (
        await db.execute(
            select(func.count())
            .select_from(Friendship)
            .where(
                Friendship.status == FriendshipStatus.accepted.value,
                or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id),
            )
        )
    ).scalar_one()
    return int(meme_count), int(friend_count)


async def _me_response(db, user: User) -> UserMe:
    meme_count, friend_count = await _counts(db, user.id)
    return UserMe.model_validate(user).model_copy(
        update={"meme_count": meme_count, "friend_count": friend_count}
    )


@router.get("/me", response_model=UserMe)
async def get_me(db: DbDep, current: CurrentUser):
    return await _me_response(db, current)


@router.patch("/me", response_model=UserMe)
async def update_me(db: DbDep, current: CurrentUser, payload: UserUpdate):
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field in _REQUIRED_PROFILE_FIELDS:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        setattr(current, field, value)
    await db.commit()
    await db.refresh(current)
    return await _me_response(db, current)


@router.put("/me/profile-picture", response_model=UserMe)
async def update_avatar(db: DbDep, current: CurrentUser, file: UploadFile = File(...)):
    data = await file.read()
    mime, ext = meme_service.validate_avatar(data, get_settings().max_image_bytes)
    key = f"avatars/{current.id}/{uuid.uuid4().hex}.{ext}"
    stored = await storage.put(key, data, mime)
    current.profile_picture_url = stored.url
    await db.commit()
    await db.refresh(current)
    return await _me_response(db, current)


@router.get("", response_model=Page[UserPublic])
async def search_users(
    db: DbDep,
    current: CurrentUser,
    search: str = Query(min_length=1, max_length=50),
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = Query(None),
):
    term = f"%{search.lower()}%"
    stmt = (
        select(User)
        .where(
            User.id != current.id,
            or_(
                func.lower(User.username).like(term),
                func.lower(func.coalesce(User.display_name, "")).like(term),
            ),
        )
        .order_by(func.lower(User.username).asc(), User.id.asc())
    )
    if cursor is not None:
        c_name, c_id = decode_str_cursor(cursor)
        stmt = stmt.where(tuple_(func.lower(User.username), User.id) > (c_name, c_id))
    stmt = stmt.limit(limit + 1)

    rows = list((await db.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = (
        encode_str_cursor(rows[-1].username.lower(), rows[-1].id) if has_more and rows else None
    )
    return Page(items=[UserPublic.model_validate(u) for u in rows], next_cursor=next_cursor)


@router.get("/{user_id}", response_model=UserWithRelation)
async def get_user(db: DbDep, current: CurrentUser, user_id: int):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    rel = await friend_service.friendship_status(db, current.id, user_id)
    return UserWithRelation.model_validate(user).model_copy(update={"friendship_status": rel})
