from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserPublic


class LikeState(BaseModel):
    like_count: int
    liked_by_me: bool


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meme_id: int
    body: str
    created_at: datetime
    author: UserPublic
