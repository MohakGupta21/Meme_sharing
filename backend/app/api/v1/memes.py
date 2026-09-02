from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status

from app.core.deps import CurrentUser, DbDep, PageDep
from app.schemas.common import Page
from app.schemas.meme import MemeOut
from app.services import feed_service, meme_service

router = APIRouter(tags=["memes"])


@router.post("/memes", response_model=MemeOut, status_code=status.HTTP_201_CREATED)
async def create_meme(
    db: DbDep,
    current: CurrentUser,
    media: UploadFile = File(...),
    title: str | None = Form(None),
    description: str | None = Form(None),
):
    meme = await meme_service.create_meme(
        db, author_id=current.id, upload=media, title=title, description=description
    )
    out = await feed_service.get_meme(db, current.id, meme.id)
    return out


@router.get("/memes/feed", response_model=Page[MemeOut])
async def feed(db: DbDep, current: CurrentUser, page: PageDep):
    items, next_cursor = await feed_service.get_feed(db, current.id, page.limit, page.cursor)
    return Page(items=items, next_cursor=next_cursor)


@router.get("/memes/{meme_id}", response_model=MemeOut)
async def get_meme(db: DbDep, current: CurrentUser, meme_id: int):
    out = await feed_service.get_meme(db, current.id, meme_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Meme not found")
    return out


@router.get("/users/{user_id}/memes", response_model=Page[MemeOut])
async def user_memes(db: DbDep, current: CurrentUser, page: PageDep, user_id: int):
    items, next_cursor = await feed_service.get_user_memes(
        db, current.id, user_id, page.limit, page.cursor
    )
    return Page(items=items, next_cursor=next_cursor)


@router.delete("/memes/{meme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meme(db: DbDep, current: CurrentUser, meme_id: int):
    await meme_service.delete_meme(db, meme_id, current.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
