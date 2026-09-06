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


def test_cloudinary_url_is_parsed_into_discrete_credentials():
    """cloudinary.config(cloudinary_url=...) does NOT parse the URL, so the backend
    must split it itself — otherwise credentials silently stay unset."""
    cloudinary = pytest.importorskip("cloudinary")
    from app.storage.cloudinary_store import CloudinaryStorage

    saved = dict(cloudinary.config().__dict__)
    try:
        CloudinaryStorage(cloudinary_url="cloudinary://12345:tOp-s3cret@my-cloud")
        cfg = cloudinary.config()
        assert cfg.cloud_name == "my-cloud"
        assert cfg.api_key == "12345"
        assert cfg.api_secret == "tOp-s3cret"
    finally:
        cloudinary.config().__dict__.clear()
        cloudinary.config().__dict__.update(saved)


def test_bad_cloudinary_url_rejected():
    pytest.importorskip("cloudinary")
    from app.storage.cloudinary_store import CloudinaryStorage

    with pytest.raises(RuntimeError):
        CloudinaryStorage(cloudinary_url="https://not-a-cloudinary-url")
