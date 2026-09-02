from __future__ import annotations

from fastapi import APIRouter, Query, Response, status
from sqlalchemy import or_, select

from app.core.deps import CurrentUser, DbDep, PageDep, encode_cursor
from app.models import Friendship, FriendshipStatus, User
from app.schemas.common import Page
from app.schemas.friend import FriendOut, FriendRequestCreate, FriendRequestOut
from app.schemas.user import UserPublic
from app.services import friend_service

router = APIRouter(prefix="/friends", tags=["friends"])


async def _users_by_id(db, ids: list[int]) -> dict[int, User]:
    if not ids:
        return {}
    rows = (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()
    return {u.id: u for u in rows}


@router.post("/requests", response_model=FriendRequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(db: DbDep, current: CurrentUser, payload: FriendRequestCreate):
    fr = await friend_service.send_request(db, current.id, payload.user_id)
    target = await db.get(User, payload.user_id)
    return FriendRequestOut(
        id=fr.id,
        status=fr.status,
        created_at=fr.created_at,
        direction="outgoing",
        user=UserPublic.model_validate(target),
    )


@router.get("/requests", response_model=list[FriendRequestOut])
async def list_requests(
    db: DbDep,
    current: CurrentUser,
    direction: str = Query("incoming", pattern="^(incoming|outgoing)$"),
):
    cond = (
        Friendship.receiver_id == current.id
        if direction == "incoming"
        else Friendship.requester_id == current.id
    )
    rows = list(
        (
            await db.execute(
                select(Friendship)
                .where(cond, Friendship.status == FriendshipStatus.pending.value)
                .order_by(Friendship.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    other_ids = [
        (fr.requester_id if direction == "incoming" else fr.receiver_id) for fr in rows
    ]
    users = await _users_by_id(db, other_ids)
    return [
        FriendRequestOut(
            id=fr.id,
            status=fr.status,
            created_at=fr.created_at,
            direction=direction,
            user=UserPublic.model_validate(users[other_id]),
        )
        for fr, other_id in zip(rows, other_ids, strict=True)
    ]


@router.post("/requests/{request_id}/accept", response_model=FriendRequestOut)
async def accept(db: DbDep, current: CurrentUser, request_id: int):
    fr = await friend_service.accept_request(db, request_id, current.id)
    other = await db.get(User, fr.requester_id)
    return FriendRequestOut(
        id=fr.id,
        status=fr.status,
        created_at=fr.created_at,
        direction="incoming",
        user=UserPublic.model_validate(other),
    )


@router.post("/requests/{request_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline(db: DbDep, current: CurrentUser, request_id: int):
    await friend_service.decline_request(db, request_id, current.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=Page[FriendOut])
async def list_friends(db: DbDep, current: CurrentUser, page: PageDep):
    stmt = select(Friendship).where(
        Friendship.status == FriendshipStatus.accepted.value,
        or_(Friendship.requester_id == current.id, Friendship.receiver_id == current.id),
    )
    if page.cursor is not None:
        stmt = stmt.where(Friendship.id < page.cursor)
    stmt = stmt.order_by(Friendship.id.desc()).limit(page.limit + 1)

    rows = list((await db.execute(stmt)).scalars().all())
    has_more = len(rows) > page.limit
    rows = rows[: page.limit]

    other_ids = [
        (fr.receiver_id if fr.requester_id == current.id else fr.requester_id) for fr in rows
    ]
    users = await _users_by_id(db, other_ids)
    items = [
        FriendOut.model_validate(users[other_id]).model_copy(update={"since": fr.updated_at})
        for fr, other_id in zip(rows, other_ids, strict=True)
    ]
    next_cursor = encode_cursor(rows[-1].id) if has_more and rows else None
    return Page(items=items, next_cursor=next_cursor)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(db: DbDep, current: CurrentUser, user_id: int):
    await friend_service.unfriend(db, current.id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
