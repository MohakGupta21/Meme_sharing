from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.core.deps import CurrentUser, DbDep, PageDep
from app.schemas.common import Page
from app.schemas.engagement import CommentCreate, CommentOut, LikeState
from app.schemas.user import UserPublic
from app.services import engagement_service

router = APIRouter(tags=["engagement"])


@router.put("/memes/{meme_id}/like", response_model=LikeState)
async def like_meme(db: DbDep, current: CurrentUser, meme_id: int):
    count, liked = await engagement_service.like(db, current.id, meme_id)
    return LikeState(like_count=count, liked_by_me=liked)


@router.delete("/memes/{meme_id}/like", response_model=LikeState)
async def unlike_meme(db: DbDep, current: CurrentUser, meme_id: int):
    count, liked = await engagement_service.unlike(db, current.id, meme_id)
    return LikeState(like_count=count, liked_by_me=liked)


@router.get("/memes/{meme_id}/comments", response_model=Page[CommentOut])
async def list_comments(db: DbDep, current: CurrentUser, page: PageDep, meme_id: int):
    rows, next_cursor = await engagement_service.list_comments(
        db, meme_id, page.limit, page.cursor
    )
    return Page(
        items=[
            CommentOut(
                id=c.id,
                meme_id=c.meme_id,
                body=c.body,
                created_at=c.created_at,
                author=UserPublic.model_validate(c.author),
            )
            for c in rows
        ],
        next_cursor=next_cursor,
    )


@router.post(
    "/memes/{meme_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED
)
async def add_comment(db: DbDep, current: CurrentUser, meme_id: int, payload: CommentCreate):
    c = await engagement_service.add_comment(db, current.id, meme_id, payload.body)
    return CommentOut(
        id=c.id,
        meme_id=c.meme_id,
        body=c.body,
        created_at=c.created_at,
        author=UserPublic.model_validate(current),
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(db: DbDep, current: CurrentUser, comment_id: int):
    await engagement_service.delete_comment(db, comment_id, current.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
