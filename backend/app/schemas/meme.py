from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserPublic


class MediaAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    url: str
    media_type: str
    mime_type: str
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None


class MemeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str | None = None
    description: str | None = None
    like_count: int
    comment_count: int
    created_at: datetime
    author: UserPublic
    media: MediaAssetOut
    liked_by_me: bool = False
