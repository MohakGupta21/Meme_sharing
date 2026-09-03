from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.storage import public_url_for


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str | None = None
    profile_picture_url: str
    lives_in: str
    caption: str
    bio: str | None = None
    created_at: datetime

    @field_validator("profile_picture_url", mode="after")
    @classmethod
    def _rebuild_avatar_url(cls, v: str) -> str:
        # Rows may carry a stale host; always resolve against current storage config.
        return public_url_for(v)


class UserMe(UserPublic):
    email: str
    meme_count: int = 0
    friend_count: int = 0


class UserWithRelation(UserPublic):
    # none | pending_outgoing | pending_incoming | friends | self
    friendship_status: str | None = None


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=500)
    lives_in: str | None = Field(default=None, min_length=1, max_length=120)
    caption: str | None = Field(default=None, min_length=1, max_length=200)
