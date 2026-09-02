"""Conversations + messages. Chat is only allowed between accepted friends."""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import encode_cursor
from app.models import Conversation, Message, User
from app.schemas.chat import ConversationOut, MessageOut
from app.schemas.user import UserPublic
from app.services import friend_service


def _utcnow() -> datetime:
    """Naive UTC — matches how SQLite stores timestamps and is fine for Postgres."""
    return datetime.now(UTC).replace(tzinfo=None)


async def _load_conversation(db: AsyncSession, conversation_id: int, user_id: int) -> Conversation:
    conv = await db.get(Conversation, conversation_id)
    if conv is None or not conv.has_participant(user_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


async def open_conversation(db: AsyncSession, user_id: int, other_id: int) -> Conversation:
    if user_id == other_id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself")
    if not await friend_service.are_friends(db, user_id, other_id):
        raise HTTPException(status_code=403, detail="You can only chat with friends")
    return await friend_service.get_or_create_conversation(db, user_id, other_id)


async def send_message(
    db: AsyncSession, conversation_id: int, sender_id: int, body: str
) -> tuple[Message, int]:
    """Returns (message, recipient_user_id)."""
    conv = await _load_conversation(db, conversation_id, sender_id)
    other_id = conv.other_user_id(sender_id)
    if not await friend_service.are_friends(db, sender_id, other_id):
        raise HTTPException(status_code=403, detail="You can only chat with friends")

    msg = Message(conversation_id=conversation_id, sender_id=sender_id, body=body.strip())
    db.add(msg)
    conv.last_message_at = _utcnow()
    await db.commit()
    await db.refresh(msg)
    return msg, other_id


async def list_messages(
    db: AsyncSession,
    conversation_id: int,
    user_id: int,
    limit: int,
    cursor: int | None,
) -> tuple[list[Message], str | None]:
    await _load_conversation(db, conversation_id, user_id)
    stmt = select(Message).where(Message.conversation_id == conversation_id)
    if cursor is not None:
        stmt = stmt.where(Message.id < cursor)
    stmt = stmt.order_by(Message.id.desc()).limit(limit + 1)
    rows = list((await db.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = encode_cursor(rows[-1].id) if has_more and rows else None
    return rows, next_cursor


async def mark_read(db: AsyncSession, conversation_id: int, reader_id: int) -> None:
    await _load_conversation(db, conversation_id, reader_id)
    await db.execute(
        update(Message)
        .where(
            and_(
                Message.conversation_id == conversation_id,
                Message.sender_id != reader_id,
                Message.read_at.is_(None),
            )
        )
        .values(read_at=_utcnow())
    )
    await db.commit()


async def list_conversations(db: AsyncSession, user_id: int) -> list[ConversationOut]:
    convs = list(
        (
            await db.execute(
                select(Conversation)
                .where(or_(Conversation.user_a_id == user_id, Conversation.user_b_id == user_id))
                .order_by(
                    Conversation.last_message_at.is_(None),
                    Conversation.last_message_at.desc(),
                )
            )
        )
        .scalars()
        .all()
    )
    if not convs:
        return []

    conv_ids = [c.id for c in convs]
    other_ids = [c.other_user_id(user_id) for c in convs]

    # one query: the other participant of every conversation
    users = {
        u.id: u
        for u in (await db.execute(select(User).where(User.id.in_(other_ids)))).scalars().all()
    }

    # one query: the latest message per conversation (greatest-id-per-group)
    latest_ids = (
        select(func.max(Message.id))
        .where(Message.conversation_id.in_(conv_ids))
        .group_by(Message.conversation_id)
        .scalar_subquery()
    )
    last_by_conv = {
        m.conversation_id: m
        for m in (
            await db.execute(select(Message).where(Message.id.in_(latest_ids)))
        ).scalars().all()
    }

    # one query: unread counts per conversation
    unread_rows = (
        await db.execute(
            select(Message.conversation_id, func.count())
            .where(
                Message.conversation_id.in_(conv_ids),
                Message.sender_id != user_id,
                Message.read_at.is_(None),
            )
            .group_by(Message.conversation_id)
        )
    ).all()
    unread_by_conv = {cid: n for cid, n in unread_rows}

    out: list[ConversationOut] = []
    for conv in convs:
        other = users.get(conv.other_user_id(user_id))
        last = last_by_conv.get(conv.id)
        out.append(
            ConversationOut(
                id=conv.id,
                other_user=UserPublic.model_validate(other),
                last_message=MessageOut.model_validate(last) if last else None,
                unread_count=int(unread_by_conv.get(conv.id, 0)),
                last_message_at=conv.last_message_at,
            )
        )
    return out
