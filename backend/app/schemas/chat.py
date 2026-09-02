from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserPublic


class ConversationCreate(BaseModel):
    user_id: int


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    body: str
    created_at: datetime
    read_at: datetime | None = None


class ConversationOut(BaseModel):
    id: int
    other_user: UserPublic
    last_message: MessageOut | None = None
    unread_count: int = 0
    last_message_at: datetime | None = None
