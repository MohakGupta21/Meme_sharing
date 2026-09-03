"""URL resolution: stored media refs are rebuilt against the current storage config."""
from __future__ import annotations

import pytest

from app.storage.resolve import public_url_for, to_storage_key

# conftest sets STORAGE_BACKEND=local; LOCAL_STORAGE_PUBLIC_URL defaults to
# http://localhost:8000/media.
_BASE = "http://localhost:8000/media"


@pytest.mark.parametrize(
    "stored",
    [
        f"{_BASE}/memes/1/abc.png",  # already-current URL
        "https://old-host.example.com/media/memes/1/abc.png",  # stale host
        "/media/memes/1/abc.png",  # root-relative
        "memes/1/abc.png",  # bare key
    ],
)
def test_key_extraction(stored):
    assert to_storage_key(stored) == "memes/1/abc.png"


@pytest.mark.parametrize(
    "stored",
    [
        f"{_BASE}/avatars/xy.png",
        "https://memeshare-api.onrender.com/media/avatars/xy.png",
        "avatars/xy.png",
    ],
)
def test_rebuilds_against_current_base(stored):
    assert public_url_for(stored) == f"{_BASE}/avatars/xy.png"


def test_idempotent():
    once = public_url_for("https://stale/media/memes/2/z.jpg")
    assert public_url_for(once) == once


def test_empty_passthrough():
    assert public_url_for("") == ""
