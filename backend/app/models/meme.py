from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at_col, pk


class Meme(Base):
    __tablename__ = "memes"
    __table_args__ = (
        Index("idx_memes_author_created", "author_id", "created_at"),
        Index("idx_memes_created", "created_at"),
    )

    id: Mapped[int] = pk()
    author_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    media_asset_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(140))
    description: Mapped[str | None] = mapped_column(String(1000))
    like_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    comment_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = created_at_col()

    author = relationship("User", lazy="joined")
    media_asset = relationship("MediaAsset", lazy="joined")
