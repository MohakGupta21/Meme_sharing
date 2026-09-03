"""Test fixtures. Runs against a throwaway SQLite database file (no server needed)."""
from __future__ import annotations

import io
import os
import tempfile

# --- configure the app for testing BEFORE importing it ---------------------
_TMP_DB = os.path.join(tempfile.mkdtemp(prefix="memeshare-test-"), "test.db")
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", f"sqlite+aiosqlite:///{_TMP_DB}"
)
os.environ["JWT_SECRET"] = "test-secret"
os.environ["DEBUG"] = "false"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["LOCAL_STORAGE_DIR"] = tempfile.mkdtemp(prefix="memeshare-media-")
os.environ["CORS_ORIGINS"] = "http://localhost:5174"

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import models  # noqa: F401,E402
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402

# child tables first, derived from the model metadata so a new table can't be missed
_TABLES_CHILD_FIRST = [t.name for t in reversed(Base.metadata.sorted_tables)]


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_friendship_pair ON friendships "
                "(min(requester_id, receiver_id), max(requester_id, receiver_id))"
            )
        )
    yield
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables(_schema):
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys=OFF"))
        for table in _TABLES_CHILD_FIRST:
            await conn.execute(text(f"DELETE FROM {table}"))
        # reset AUTOINCREMENT counters if the bookkeeping table exists
        has_seq = (
            await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
            )
        ).first()
        if has_seq:
            await conn.execute(text("DELETE FROM sqlite_sequence"))
        await conn.execute(text("PRAGMA foreign_keys=ON"))
    yield


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _png_bytes() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (120, 80, 200)).save(buf, format="PNG")
    return buf.getvalue()


@pytest_asyncio.fixture
def png_bytes() -> bytes:
    return _png_bytes()


@pytest_asyncio.fixture
def register():
    """Returns an async helper: register(client, username) -> dict with tokens + user + headers."""

    async def _register(client: AsyncClient, username: str, **overrides):
        data = {
            "email": overrides.get("email", f"{username}@example.com"),
            "username": username,
            "password": overrides.get("password", "supersecret123"),
            "lives_in": overrides.get("lives_in", "Berlin"),
            "caption": overrides.get("caption", "just here for the memes"),
        }
        files = {"profile_picture": ("a.png", _png_bytes(), "image/png")}
        resp = await client.post("/api/v1/auth/signup", data=data, files=files)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        body["headers"] = {"Authorization": f"Bearer {body['access_token']}"}
        return body

    return _register
