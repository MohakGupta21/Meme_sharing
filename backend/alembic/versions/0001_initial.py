"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-02

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# BIGINT on Postgres, INTEGER on SQLite (so an autoincrement PK aliases rowid).
BigIntId = sa.BigInteger().with_variant(sa.Integer, "sqlite")

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", BigIntId, primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("username", sa.String(30), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("display_name", sa.String(80)),
        sa.Column("profile_picture_url", sa.Text(), nullable=False),
        sa.Column("lives_in", sa.String(120), nullable=False),
        sa.Column("caption", sa.String(200), nullable=False),
        sa.Column("bio", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "refresh_tokens",
        sa.Column("id", BigIntId, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jti", sa.String(64), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("jti", name="uq_refresh_tokens_jti"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"])

    op.create_table(
        "media_assets",
        sa.Column("id", BigIntId, primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("media_type", sa.String(10), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("width", sa.Integer()),
        sa.Column("height", sa.Integer()),
        sa.Column("duration_ms", sa.Integer()),
        sa.Column("bytes", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("media_type IN ('image','video')", name="ck_media_type"),
    )
    op.create_index("ix_media_assets_owner_id", "media_assets", ["owner_id"])

    op.create_table(
        "memes",
        sa.Column("id", BigIntId, primary_key=True, autoincrement=True),
        sa.Column("author_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("media_asset_id", sa.BigInteger(), sa.ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String(140)),
        sa.Column("description", sa.String(1000)),
        sa.Column("like_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("comment_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_memes_author_created", "memes", ["author_id", "created_at"])
    op.create_index("idx_memes_created", "memes", ["created_at"])

    op.create_table(
        "likes",
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("meme_id", sa.BigInteger(), sa.ForeignKey("memes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "comments",
        sa.Column("id", BigIntId, primary_key=True, autoincrement=True),
        sa.Column("meme_id", sa.BigInteger(), sa.ForeignKey("memes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.String(1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_comments_meme_created", "comments", ["meme_id", "created_at"])

    op.create_table(
        "friendships",
        sa.Column("id", BigIntId, primary_key=True, autoincrement=True),
        sa.Column("requester_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("receiver_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(10), server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("requester_id <> receiver_id", name="ck_friendship_not_self"),
        sa.CheckConstraint(
            "status IN ('pending','accepted','declined','blocked')", name="ck_friendship_status"
        ),
        sa.UniqueConstraint("requester_id", "receiver_id", name="uq_friendship_directed"),
    )
    op.create_index("ix_friendships_requester_id", "friendships", ["requester_id"])
    op.create_index("ix_friendships_receiver_id", "friendships", ["receiver_id"])
    # one relationship per unordered pair, regardless of direction.
    # SQLite spells least/greatest as min()/max(); Postgres uses LEAST()/GREATEST().
    if op.get_bind().dialect.name == "sqlite":
        op.execute(
            "CREATE UNIQUE INDEX uq_friendship_pair ON friendships "
            "(min(requester_id, receiver_id), max(requester_id, receiver_id))"
        )
    else:
        op.execute(
            "CREATE UNIQUE INDEX uq_friendship_pair ON friendships "
            "(LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id))"
        )

    op.create_table(
        "conversations",
        sa.Column("id", BigIntId, primary_key=True, autoincrement=True),
        sa.Column("user_a_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_b_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("user_a_id < user_b_id", name="ck_conversation_order"),
        sa.UniqueConstraint("user_a_id", "user_b_id", name="uq_conversation_pair"),
    )
    op.create_index("ix_conversations_user_a_id", "conversations", ["user_a_id"])
    op.create_index("ix_conversations_user_b_id", "conversations", ["user_b_id"])

    op.create_table(
        "messages",
        sa.Column("id", BigIntId, primary_key=True, autoincrement=True),
        sa.Column("conversation_id", sa.BigInteger(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.String(4000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_messages_conv_created", "messages", ["conversation_id", "created_at"])


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_table("conversations")
    op.execute("DROP INDEX IF EXISTS uq_friendship_pair")
    op.drop_table("friendships")
    op.drop_table("comments")
    op.drop_table("likes")
    op.drop_table("memes")
    op.drop_table("media_assets")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
