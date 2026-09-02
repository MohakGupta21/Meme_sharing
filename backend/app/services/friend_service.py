"""Friend requests + social graph."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Conversation, Friendship, FriendshipStatus, User


def _pair(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


async def _existing(db: AsyncSession, u1: int, u2: int) -> Friendship | None:
    return (
        await db.execute(
            select(Friendship).where(
                or_(
                    and_(Friendship.requester_id == u1, Friendship.receiver_id == u2),
                    and_(Friendship.requester_id == u2, Friendship.receiver_id == u1),
                )
            )
        )
    ).scalar_one_or_none()


async def _find_conversation(db: AsyncSession, lo: int, hi: int) -> Conversation | None:
    return (
        await db.execute(
            select(Conversation).where(
                Conversation.user_a_id == lo, Conversation.user_b_id == hi
            )
        )
    ).scalar_one_or_none()


async def get_or_create_conversation(db: AsyncSession, u1: int, u2: int) -> Conversation:
    lo, hi = _pair(u1, u2)
    conv = await _find_conversation(db, lo, hi)
    if conv is not None:
        return conv
    conv = Conversation(user_a_id=lo, user_b_id=hi)
    db.add(conv)
    try:
        # SAVEPOINT: a race here rolls back only this insert, not the caller's
        # outer transaction (e.g. the friendship status change in accept_request).
        async with db.begin_nested():
            await db.flush()
    except IntegrityError:
        db.expunge(conv)
        existing = await _find_conversation(db, lo, hi)
        if existing is None:  # pragma: no cover - lost the row we know exists
            raise
        return existing
    return conv


async def send_request(db: AsyncSession, requester_id: int, target_id: int) -> Friendship:
    if requester_id == target_id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    if await db.get(User, target_id) is None:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await _existing(db, requester_id, target_id)
    if existing is not None:
        if existing.status == FriendshipStatus.accepted.value:
            raise HTTPException(status_code=409, detail="Already friends")
        if existing.status == FriendshipStatus.pending.value:
            raise HTTPException(status_code=409, detail="A pending request already exists")
        # previously declined -> allow a fresh request from the current requester
        existing.requester_id = requester_id
        existing.receiver_id = target_id
        existing.status = FriendshipStatus.pending.value
        await db.commit()
        await db.refresh(existing)
        return existing

    fr = Friendship(
        requester_id=requester_id, receiver_id=target_id, status=FriendshipStatus.pending.value
    )
    db.add(fr)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A request already exists") from exc
    await db.refresh(fr)
    return fr


async def _load_request(db: AsyncSession, request_id: int, receiver_id: int) -> Friendship:
    fr = await db.get(Friendship, request_id)
    if fr is None or fr.status != FriendshipStatus.pending.value:
        raise HTTPException(status_code=404, detail="Request not found")
    if fr.receiver_id != receiver_id:
        raise HTTPException(status_code=403, detail="Not your request to answer")
    return fr


async def accept_request(db: AsyncSession, request_id: int, receiver_id: int) -> Friendship:
    fr = await _load_request(db, request_id, receiver_id)
    fr.status = FriendshipStatus.accepted.value
    await get_or_create_conversation(db, fr.requester_id, fr.receiver_id)
    await db.commit()
    await db.refresh(fr)
    return fr


async def decline_request(db: AsyncSession, request_id: int, receiver_id: int) -> None:
    fr = await _load_request(db, request_id, receiver_id)
    fr.status = FriendshipStatus.declined.value
    await db.commit()


async def unfriend(db: AsyncSession, user_id: int, other_id: int) -> None:
    fr = await _existing(db, user_id, other_id)
    if fr is None or fr.status != FriendshipStatus.accepted.value:
        raise HTTPException(status_code=404, detail="Not friends")
    await db.delete(fr)
    await db.commit()  # conversation + messages are intentionally kept


async def are_friends(db: AsyncSession, u1: int, u2: int) -> bool:
    fr = await _existing(db, u1, u2)
    return fr is not None and fr.status == FriendshipStatus.accepted.value


async def friend_ids(db: AsyncSession, user_id: int) -> list[int]:
    rows = (
        await db.execute(
            select(Friendship.requester_id, Friendship.receiver_id).where(
                Friendship.status == FriendshipStatus.accepted.value,
                or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id),
            )
        )
    ).all()
    out: list[int] = []
    for requester_id, receiver_id in rows:
        out.append(receiver_id if requester_id == user_id else requester_id)
    return out


async def friendship_status(db: AsyncSession, viewer_id: int, other_id: int) -> str:
    if viewer_id == other_id:
        return "self"
    fr = await _existing(db, viewer_id, other_id)
    if fr is None or fr.status in (FriendshipStatus.declined.value, FriendshipStatus.blocked.value):
        return "none"
    if fr.status == FriendshipStatus.accepted.value:
        return "friends"
    return "pending_outgoing" if fr.requester_id == viewer_id else "pending_incoming"
