"""Feed + per-user meme listing with keyset pagination.

Visibility model: **memes are public**. Anyone signed in can open a meme by id and
like/comment on it (AGENTS.md: "Other people can comment on the meme, like the meme").
The feed here is only a *discovery* filter — it surfaces memes from the viewer and
their accepted friends. It is not an access-control boundary.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import encode_cursor
from app.models import Meme
from app.schemas.meme import MediaAssetOut, MemeOut
from app.schemas.user import UserPublic
from app.services import friend_service, meme_service


def _serialize(meme: Meme, liked_ids: set[int]) -> MemeOut:
    return MemeOut(
        id=meme.id,
        title=meme.title,
        description=meme.description,
        like_count=meme.like_count,
        comment_count=meme.comment_count,
        created_at=meme.created_at,
        author=UserPublic.model_validate(meme.author),
        media=MediaAssetOut.model_validate(meme.media_asset),
        liked_by_me=meme.id in liked_ids,
    )


async def _paginate(
    db: AsyncSession,
    base_filter,
    viewer_id: int,
    limit: int,
    cursor: int | None,
) -> tuple[list[MemeOut], str | None]:
    stmt = select(Meme).where(base_filter)
    if cursor is not None:
        stmt = stmt.where(Meme.id < cursor)
    stmt = stmt.order_by(Meme.id.desc()).limit(limit + 1)

    rows = list((await db.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]

    liked = await meme_service.liked_meme_ids(db, viewer_id, [m.id for m in rows])
    items = [_serialize(m, liked) for m in rows]
    next_cursor = encode_cursor(rows[-1].id) if has_more and rows else None
    return items, next_cursor


async def get_feed(
    db: AsyncSession, viewer_id: int, limit: int, cursor: int | None
) -> tuple[list[MemeOut], str | None]:
    author_ids = await friend_service.friend_ids(db, viewer_id)
    author_ids.append(viewer_id)
    return await _paginate(db, Meme.author_id.in_(author_ids), viewer_id, limit, cursor)


async def get_user_memes(
    db: AsyncSession, viewer_id: int, target_id: int, limit: int, cursor: int | None
) -> tuple[list[MemeOut], str | None]:
    return await _paginate(db, Meme.author_id == target_id, viewer_id, limit, cursor)


async def get_meme(db: AsyncSession, viewer_id: int, meme_id: int) -> MemeOut | None:
    meme = await db.get(Meme, meme_id)
    if meme is None:
        return None
    liked = await meme_service.liked_meme_ids(db, viewer_id, [meme.id])
    return _serialize(meme, liked)
