"""Resolve a stored media reference to a public URL against the *current* config.

Historically the absolute URL was persisted into the DB at upload time
(``media_assets.url``, ``users.profile_picture_url``). That bakes the host into
every row, so moving storage backends or changing the public host (localhost ->
Render -> an object-store/CDN domain) silently strands existing rows.

These helpers reduce whatever is stored — an absolute URL with any host, or a
bare storage key — back to the object key, then rebuild the URL from the active
storage backend. Safe to run on already-correct values (idempotent).
"""
from __future__ import annotations

from app.core.config import get_settings
from app.storage.factory import get_storage

_MEDIA_MARKER = "/media/"


def _known_bases() -> list[str]:
    s = get_settings()
    return [
        base.rstrip("/")
        for base in (s.local_storage_public_url, s.s3_public_url or "")
        if base
    ]


def to_storage_key(stored: str) -> str:
    """Best-effort reduction of a stored media reference to its bare object key.

    Handles a current-config URL, an absolute URL with a stale host, a
    root-relative ``/media/...`` path, and an already-bare key.
    """
    s = stored.strip()
    if not s:
        return s
    for base in _known_bases():
        if s.startswith(base + "/"):
            return s[len(base) + 1 :]
    from app.storage.cloudinary_store import to_cloudinary_key

    cloud_key = to_cloudinary_key(s)  # .../image/upload/v1/memes/1/a.png -> memes/1/a.png
    if cloud_key is not None:
        return cloud_key
    if "://" in s:  # drop scheme://host, keep the leading-slash path
        rest = s.split("://", 1)[1]
        slash = rest.find("/")
        s = rest[slash:] if slash != -1 else ""
    marker = s.rfind(_MEDIA_MARKER)  # the local static mount segment
    if marker != -1:
        return s[marker + len(_MEDIA_MARKER) :]
    return s.lstrip("/")


def public_url_for(stored: str) -> str:
    """Rebuild a media URL from the current storage config. Idempotent."""
    if not stored:
        return stored
    return get_storage().url_for(to_storage_key(stored))
