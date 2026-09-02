from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_col, pk


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint("user_a_id < user_b_id", name="ck_conversation_order"),
        UniqueConstraint("user_a_id", "user_b_id", name="uq_conversation_pair"),
    )

    id: Mapped[int] = pk()
    user_a_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_b_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = created_at_col()
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def other_user_id(self, user_id: int) -> int:
        return self.user_b_id if user_id == self.user_a_id else self.user_a_id

    def has_participant(self, user_id: int) -> bool:
        return user_id in (self.user_a_id, self.user_b_id)
