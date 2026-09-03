from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_col, pk


class RefreshToken(Base):
    """Hashed refresh-token records for rotation + revocation."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = pk()
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jti: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    # Naive UTC (see app.core.security.create_refresh_token). A tz-aware column
    # round-trips as aware on asyncpg but naive on SQLite, which breaks the
    # expiry comparison in auth_service on Postgres only.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    revoked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = created_at_col()
