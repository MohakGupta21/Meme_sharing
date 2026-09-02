from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_col


class Like(Base):
    __tablename__ = "likes"
    # composite PK already covers "likes by user"; this covers "who liked this meme"
    __table_args__ = (Index("ix_likes_meme", "meme_id"),)

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    meme_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("memes.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = created_at_col()
