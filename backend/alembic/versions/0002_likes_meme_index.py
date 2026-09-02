"""add ix_likes_meme

Revision ID: 0002_likes_meme_index
Revises: 0001_initial
Create Date: 2026-09-02

"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002_likes_meme_index"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_likes_meme", "likes", ["meme_id"])


def downgrade() -> None:
    op.drop_index("ix_likes_meme", table_name="likes")
