from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.user import UserPublic
from app.storage import public_url_for


class MediaAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    url: str
    media_type: str
    mime_type: str
    width: int | None = None
    height: int | None = None
    duration_ms: int | None = None

    @field_validator("url", mode="after")
    @classmethod
    def _rebuild_url(cls, v: str) -> str:
        # Rows may carry a stale host; always resolve against current storage config.
        return public_url_for(v)


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
