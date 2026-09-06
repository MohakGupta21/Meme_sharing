from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.storage.base import StorageBackend
from app.storage.local import LocalStorage


@lru_cache
def get_storage() -> StorageBackend:
    s = get_settings()
    if s.storage_backend == "cloudinary":
        if not s.cloudinary_url and not (
            s.cloudinary_cloud_name and s.cloudinary_api_key and s.cloudinary_api_secret
        ):
            raise RuntimeError(
                "STORAGE_BACKEND=cloudinary but no credentials: set CLOUDINARY_URL or "
                "CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET"
            )
        from app.storage.cloudinary_store import CloudinaryStorage

        return CloudinaryStorage(
            cloud_name=s.cloudinary_cloud_name,
            api_key=s.cloudinary_api_key,
            api_secret=s.cloudinary_api_secret,
            cloudinary_url=s.cloudinary_url,
            secure=s.cloudinary_secure,
        )
    if s.storage_backend == "s3":
        missing = [
            name
            for name, val in (
                ("S3_BUCKET", s.s3_bucket),
                ("S3_ACCESS_KEY", s.s3_access_key),
                ("S3_SECRET_KEY", s.s3_secret_key),
            )
            if not val
        ]
        if missing:
            raise RuntimeError(
                "STORAGE_BACKEND=s3 but missing required settings: " + ", ".join(missing)
            )
        try:
            # Imported lazily so boto3 is only required when S3 is actually used.
            from app.storage.s3 import S3Storage
        except ModuleNotFoundError as exc:  # boto3 lives in the '[prod]' extra
            raise RuntimeError(
                "STORAGE_BACKEND=s3 requires boto3 — install with: pip install -e '.[prod]'"
            ) from exc

        return S3Storage(
            s.s3_bucket,
            endpoint_url=s.s3_endpoint_url,
            region=s.s3_region,
            access_key=s.s3_access_key,
            secret_key=s.s3_secret_key,
            public_url=s.s3_public_url,
        )
    return LocalStorage(s.local_storage_dir, s.local_storage_public_url)
