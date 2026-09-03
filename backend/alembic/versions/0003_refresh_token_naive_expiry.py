"""refresh_tokens.expires_at -> naive timestamp

Revision ID: 0003_refresh_token_naive_expiry
Revises: 0002_likes_meme_index
Create Date: 2026-09-03

The app stores refresh-token expiry as naive UTC. A tz-aware column round-trips
as naive on SQLite but tz-aware on asyncpg, breaking the expiry comparison on
Postgres only. Store it as `TIMESTAMP WITHOUT TIME ZONE` on every dialect.

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_refresh_token_naive_expiry"
down_revision: str | None = "0002_likes_meme_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Existing values are UTC instants; reinterpret them as naive UTC.
        op.alter_column(
            "refresh_tokens",
            "expires_at",
            type_=sa.DateTime(timezone=False),
            existing_nullable=False,
            postgresql_using="expires_at AT TIME ZONE 'UTC'",
        )
    else:
        with op.batch_alter_table("refresh_tokens") as batch:
            batch.alter_column(
                "expires_at",
                type_=sa.DateTime(timezone=False),
                existing_nullable=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.alter_column(
            "refresh_tokens",
            "expires_at",
            type_=sa.DateTime(timezone=True),
            existing_nullable=False,
            postgresql_using="expires_at AT TIME ZONE 'UTC'",
        )
    else:
        with op.batch_alter_table("refresh_tokens") as batch:
            batch.alter_column(
                "expires_at",
                type_=sa.DateTime(timezone=True),
                existing_nullable=False,
            )
