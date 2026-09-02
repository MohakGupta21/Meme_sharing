from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_col, pk, updated_at_col


class FriendshipStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    blocked = "blocked"


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        CheckConstraint("requester_id <> receiver_id", name="ck_friendship_not_self"),
        CheckConstraint(
            "status IN ('pending','accepted','declined','blocked')", name="ck_friendship_status"
        ),
        UniqueConstraint("requester_id", "receiver_id", name="uq_friendship_directed"),
    )

    id: Mapped[int] = pk()
    requester_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    receiver_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default=FriendshipStatus.pending.value,
        server_default=FriendshipStatus.pending.value,
    )
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = updated_at_col()
