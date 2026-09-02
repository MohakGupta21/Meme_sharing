"""Likes + comments. Counters are mutated in the same transaction as the row."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import and_, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import encode_cursor
from app.models import Comment, Like, Meme


async def _get_meme_or_404(db: AsyncSession, meme_id: int) -> Meme:
    meme = await db.get(Meme, meme_id)
    if meme is None:
        raise HTTPException(status_code=404, detail="Meme not found")
    return meme


async def like(db: AsyncSession, user_id: int, meme_id: int) -> tuple[int, bool]:
    """Idempotent. The (user_id, meme_id) primary key guards against double-likes
    even under concurrency; the counter is bumped in the same transaction."""
    await _get_meme_or_404(db, meme_id)
    already = await db.get(Like, {"user_id": user_id, "meme_id": meme_id})
    if already is None:
        db.add(Like(user_id=user_id, meme_id=meme_id))
        try:
            await db.flush()
            await db.execute(
                update(Meme).where(Meme.id == meme_id).values(like_count=Meme.like_count + 1)
            )
            await db.commit()
        except IntegrityError:  # raced with another like for the same pair
            await db.rollback()
    count = (await db.execute(select(Meme.like_count).where(Meme.id == meme_id))).scalar_one()
    return count, True


async def unlike(db: AsyncSession, user_id: int, meme_id: int) -> tuple[int, bool]:
    await _get_meme_or_404(db, meme_id)
    existing = await db.get(Like, {"user_id": user_id, "meme_id": meme_id})
    if existing is not None:
        await db.delete(existing)
        await db.execute(
            update(Meme)
            .where(and_(Meme.id == meme_id, Meme.like_count > 0))
            .values(like_count=Meme.like_count - 1)
        )
        await db.commit()
    count = (await db.execute(select(Meme.like_count).where(Meme.id == meme_id))).scalar_one()
    return count, False


async def add_comment(db: AsyncSession, user_id: int, meme_id: int, body: str) -> Comment:
    await _get_meme_or_404(db, meme_id)
    comment = Comment(meme_id=meme_id, author_id=user_id, body=body.strip())
    db.add(comment)
    await db.execute(
        update(Meme).where(Meme.id == meme_id).values(comment_count=Meme.comment_count + 1)
    )
    await db.commit()
    await db.refresh(comment)
    return comment


async def list_comments(
    db: AsyncSession, meme_id: int, limit: int, cursor: int | None
) -> tuple[list[Comment], str | None]:
    stmt = select(Comment).where(Comment.meme_id == meme_id)
    if cursor is not None:
        stmt = stmt.where(Comment.id > cursor)
    stmt = stmt.order_by(Comment.id.asc()).limit(limit + 1)
    rows = list((await db.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = encode_cursor(rows[-1].id) if has_more and rows else None
    return rows, next_cursor


async def delete_comment(db: AsyncSession, comment_id: int, requester_id: int) -> None:
    comment = await db.get(Comment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    meme = await db.get(Meme, comment.meme_id)
    if requester_id not in (comment.author_id, meme.author_id if meme else None):
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.delete(comment)
    if meme is not None:
        await db.execute(
            update(Meme)
            .where(and_(Meme.id == meme.id, Meme.comment_count > 0))
            .values(comment_count=Meme.comment_count - 1)
        )
    await db.commit()


async def recompute_counters(db: AsyncSession) -> int:
    """Repair `like_count` / `comment_count` from the source tables. Safe to run any
    time; returns the number of meme rows touched. Wire to a cron or an admin route."""
    like_counts: dict[int, int] = {
        mid: n
        for mid, n in (
            await db.execute(select(Like.meme_id, func.count()).group_by(Like.meme_id))
        ).all()
    }
    comment_counts: dict[int, int] = {
        mid: n
        for mid, n in (
            await db.execute(select(Comment.meme_id, func.count()).group_by(Comment.meme_id))
        ).all()
    }
    touched = 0
    for meme in (await db.execute(select(Meme))).scalars().all():
        lc, cc = like_counts.get(meme.id, 0), comment_counts.get(meme.id, 0)
        if meme.like_count != lc or meme.comment_count != cc:
            meme.like_count, meme.comment_count = lc, cc
            touched += 1
    await db.commit()
    return touched
