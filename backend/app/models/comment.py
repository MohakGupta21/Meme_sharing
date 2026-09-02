from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at_col, pk


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (Index("idx_comments_meme_created", "meme_id", "created_at"),)

    id: Mapped[int] = pk()
    meme_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("memes.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_at: Mapped[datetime] = created_at_col()

    author = relationship("User", lazy="joined")
