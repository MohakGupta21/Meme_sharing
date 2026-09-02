"""Declarative base + shared column helpers."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# BIGINT everywhere except SQLite, where an auto-incrementing PK must be a plain
# INTEGER (alias for rowid). Use this for every id / FK column.
BigIntId = BigInteger().with_variant(Integer, "sqlite")


def pk() -> Mapped[int]:
    return mapped_column(BigIntId, primary_key=True, autoincrement=True)


def created_at_col() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


def updated_at_col() -> Mapped[datetime]:
    return mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
