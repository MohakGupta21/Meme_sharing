from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserPublic


class FriendRequestCreate(BaseModel):
    user_id: int


class FriendRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    created_at: datetime
    direction: str  # incoming | outgoing
    user: UserPublic  # the other party


class FriendOut(UserPublic):
    since: datetime | None = None
