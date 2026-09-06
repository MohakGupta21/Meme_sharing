"""Pure key<->URL helpers for the Cloudinary backend (no SDK / network needed)."""
from __future__ import annotations

import pytest

from app.storage.cloudinary_store import _split_key, to_cloudinary_key


@pytest.mark.parametrize(
    ("key", "expected"),
    [
        ("memes/1/abc.jpg", ("memes/1/abc", "jpg")),
        ("avatars/deadbeef.PNG", ("avatars/deadbeef", "png")),
        ("memes/9/clip.mp4", ("memes/9/clip", "mp4")),
        ("/memes/1/abc.gif/", ("memes/1/abc", "gif")),
        ("noext", ("noext", "")),
    ],
)
def test_split_key(key, expected):
    assert _split_key(key) == expected


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://res.cloudinary.com/demo/image/upload/v123/memes/1/a.png", "memes/1/a.png"),
        ("https://res.cloudinary.com/demo/image/upload/memes/1/a.png", "memes/1/a.png"),
        ("https://res.cloudinary.com/demo/video/upload/v1/memes/9/clip.mp4", "memes/9/clip.mp4"),
        ("https://example.com/media/memes/1/a.png", None),
        ("memes/1/a.png", None),
    ],
)
def test_to_cloudinary_key(url, expected):
    assert to_cloudinary_key(url) == expected
