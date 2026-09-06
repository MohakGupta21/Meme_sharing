from __future__ import annotations

import logging
import re
from urllib.parse import unquote, urlsplit

from fastapi import HTTPException, status

from app.storage.base import StorageBackend, StoredObject

log = logging.getLogger("app.storage")

# Keys are minted by the app as ``memes/<id>/<uuid>.<ext>`` / ``avatars/<uuid>.<ext>``.
# Cloudinary stores the "public id" (folder path, no extension) separately from the
# delivered format, so we split the key on its extension and rebuild deterministically.
_VIDEO_EXT = {"mp4", "webm", "mov", "m4v", "ogv", "avi", "mkv"}

# A Cloudinary delivery URL: .../<resource_type>/upload/[v<version>/]<public_id>.<ext>
_DELIVERY_RE = re.compile(r"/(?:image|video|raw)/(?:upload|authenticated)/(?:v\d+/)?(.+)$")


def _reason(exc: Exception) -> str:
    """A short, secret-free description of a Cloudinary failure.

    The cloudinary SDK raises its typed exceptions (``NotAllowed``, ``BadRequest``,
    …) with the API's plain ``error.message`` string as the payload — no
    credentials in it — so it is safe to pass through to the client and logs."""
    msg = str(exc).strip()
    return f"{type(exc).__name__}: {msg}" if msg else type(exc).__name__


def _split_key(key: str) -> tuple[str, str]:
    """('memes/1/abc.jpg') -> ('memes/1/abc', 'jpg'); no extension -> ('...', '')."""
    key = key.strip("/")
    head, _, tail = key.rpartition("/")
    if "." in tail:
        stem, ext = tail.rsplit(".", 1)
        return (f"{head}/{stem}" if head else stem), ext.lower()
    return key, ""


def _resource_type_for_ext(ext: str) -> str:
    return "video" if ext in _VIDEO_EXT else "image"


class CloudinaryStorage(StorageBackend):
    """Stores memes and avatars in a Cloudinary account.

    The bytes live in Cloudinary; Postgres keeps only the object key + URL, so the
    two stay in sync and survive redeploys (unlike the ``local`` backend)."""

    def __init__(
        self,
        *,
        cloud_name: str | None = None,
        api_key: str | None = None,
        api_secret: str | None = None,
        cloudinary_url: str | None = None,
        secure: bool = True,
    ) -> None:
        try:
            import cloudinary  # cloudinary lives in the '[prod]' extra
            import cloudinary.api
            import cloudinary.uploader
            import cloudinary.utils
        except ModuleNotFoundError as exc:  # pragma: no cover - env-dependent
            raise RuntimeError(
                "STORAGE_BACKEND=cloudinary requires the cloudinary SDK — "
                "install with: pip install -e '.[prod]'"
            ) from exc

        self._cloudinary = cloudinary
        if cloudinary_url:
            # Parse cloudinary://<api_key>:<api_secret>@<cloud_name> ourselves and
            # feed discrete values: cloudinary.config(cloudinary_url=...) does NOT
            # parse the URL (the SDK only reads the CLOUDINARY_URL *env var*, at
            # import time), so relying on it silently leaves credentials unset.
            parsed = urlsplit(cloudinary_url.strip())
            if parsed.scheme != "cloudinary" or not parsed.hostname:
                raise RuntimeError(
                    "CLOUDINARY_URL must look like "
                    "cloudinary://<api_key>:<api_secret>@<cloud_name>"
                )
            cloud_name = parsed.hostname
            api_key = unquote(parsed.username) if parsed.username else None
            api_secret = unquote(parsed.password) if parsed.password else None

        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=secure,
        )
        cfg = cloudinary.config()
        if not (cfg.cloud_name and cfg.api_key and cfg.api_secret):
            raise RuntimeError(
                "STORAGE_BACKEND=cloudinary but credentials are incomplete "
                "(set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET)"
            )
        self._secure = secure

    def put(self, key: str, data: bytes, content_type: str) -> StoredObject:
        public_id, _ = _split_key(key)
        resource_type = "video" if content_type.startswith("video/") else "image"
        try:
            result = self._cloudinary.uploader.upload(
                data,
                public_id=public_id,
                resource_type=resource_type,
                overwrite=True,
                invalidate=True,
                use_filename=False,
                unique_filename=False,
            )
        except HTTPException:
            raise
        except Exception as exc:
            log.exception("Cloudinary upload failed (key=%s)", key)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Media storage rejected the upload ({_reason(exc)})",
            ) from exc
        return StoredObject(key=key, url=result.get("secure_url") or result["url"])

    def delete(self, key: str) -> None:
        public_id, ext = _split_key(key)
        try:
            self._cloudinary.uploader.destroy(
                public_id,
                resource_type=_resource_type_for_ext(ext),
                invalidate=True,
            )
        except Exception:
            log.exception("Cloudinary destroy failed (key=%s)", key)
            # Best-effort, like the other backends: a dangling asset is harmless.

    def url_for(self, key: str) -> str:
        public_id, ext = _split_key(key)
        url, _ = self._cloudinary.utils.cloudinary_url(
            public_id,
            resource_type=_resource_type_for_ext(ext),
            format=ext or None,
            secure=self._secure,
        )
        return url

    def check(self) -> None:
        """Ping the Cloudinary API (used by /health/storage)."""
        self._cloudinary.api.ping()


def to_cloudinary_key(url: str) -> str | None:
    """Reduce a Cloudinary delivery URL back to the bare object key, or None if it
    is not one. ``.../image/upload/v123/memes/1/abc.png`` -> ``memes/1/abc.png``."""
    m = _DELIVERY_RE.search(url)
    return m.group(1) if m else None
