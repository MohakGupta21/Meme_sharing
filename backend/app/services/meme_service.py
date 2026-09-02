"""Meme upload: validate media, probe metadata, store blob, persist rows."""
from __future__ import annotations

import io
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Like, MediaAsset, Meme
from app.storage import aio as storage

_IMAGE_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}
_VIDEO_MIME = {"video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov"}
_AVATAR_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
# SVG is deliberately excluded (script execution risk).


def _magic_bytes_mime(data: bytes) -> str | None:
    """Content sniffing from magic bytes only — the client-supplied content-type is
    never trusted. Returns None for anything not on the allow-list."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:4] == b"\x1a\x45\xdf\xa3":
        return "video/webm"
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand[:2] == b"qt":
            return "video/quicktime"
        return "video/mp4"
    return None


def _sniff_mime(data: bytes) -> str:
    mime = _magic_bytes_mime(data)
    if mime:
        return mime
    try:  # libmagic as a secondary check only
        import magic

        detected = magic.from_buffer(data, mime=True)
        if detected in _IMAGE_MIME or detected in _VIDEO_MIME:
            return detected
    except Exception:
        pass
    return "application/octet-stream"


def _probe_image(data: bytes) -> tuple[int | None, int | None]:
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as im:
            im.verify()
        with Image.open(io.BytesIO(data)) as im2:
            return im2.width, im2.height
    except Exception:
        return None, None


def validate_avatar(data: bytes, max_bytes: int) -> tuple[str, str]:
    """Return (mime, ext) for a valid avatar image, else raise HTTPException."""
    if not data:
        raise HTTPException(status_code=422, detail="profile_picture is required")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds {max_bytes} bytes",
        )
    mime = _sniff_mime(data)
    if mime not in _AVATAR_MIME:
        raise HTTPException(status_code=415, detail="profile picture must be jpg/png/webp")
    if _probe_image(data) == (None, None):
        raise HTTPException(status_code=415, detail="profile picture is not a valid image")
    return mime, _AVATAR_MIME[mime]


async def create_meme(
    db: AsyncSession,
    *,
    author_id: int,
    upload: UploadFile,
    title: str | None,
    description: str | None,
) -> Meme:
    settings = get_settings()
    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    mime = _sniff_mime(data)
    if mime in _IMAGE_MIME:
        media_type, ext, limit = "image", _IMAGE_MIME[mime], settings.max_image_bytes
    elif mime in _VIDEO_MIME:
        media_type, ext, limit = "video", _VIDEO_MIME[mime], settings.max_video_bytes
    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported media type (allowed: jpeg, png, gif, webp, mp4, webm, mov)",
        )

    if len(data) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {limit} bytes",
        )

    width = height = None
    if media_type == "image":
        width, height = _probe_image(data)
        if (width, height) == (None, None):
            raise HTTPException(status_code=415, detail="File is not a valid image")

    key = f"memes/{author_id}/{uuid.uuid4().hex}.{ext}"
    stored = await storage.put(key, data, mime)

    asset = MediaAsset(
        owner_id=author_id,
        storage_key=stored.key,
        url=stored.url,
        media_type=media_type,
        mime_type=mime,
        width=width,
        height=height,
        bytes=len(data),
    )
    db.add(asset)
    try:
        await db.flush()
        meme = Meme(
            author_id=author_id,
            media_asset_id=asset.id,
            title=title or None,
            description=description or None,
        )
        db.add(meme)
        await db.commit()
    except Exception:
        await db.rollback()
        await storage.delete(stored.key)  # don't leave an orphaned blob
        raise
    await db.refresh(meme)
    return meme


async def delete_meme(db: AsyncSession, meme_id: int, requester_id: int) -> None:
    meme = await db.get(Meme, meme_id)
    if meme is None:
        raise HTTPException(status_code=404, detail="Meme not found")
    if meme.author_id != requester_id:
        raise HTTPException(status_code=403, detail="Not your meme")
    asset = await db.get(MediaAsset, meme.media_asset_id)
    await db.delete(meme)  # likes + comments cascade at the DB level
    await db.flush()
    if asset is not None:
        await db.delete(asset)
    await db.commit()
    if asset is not None:
        try:
            await storage.delete(asset.storage_key)
        except Exception:
            pass  # row is gone; a dangling blob is harmless and GC-able


async def liked_meme_ids(db: AsyncSession, user_id: int, meme_ids: list[int]) -> set[int]:
    if not meme_ids:
        return set()
    rows = await db.execute(
        select(Like.meme_id).where(Like.user_id == user_id, Like.meme_id.in_(meme_ids))
    )
    return {r[0] for r in rows.all()}
