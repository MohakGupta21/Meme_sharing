from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.storage.base import StorageBackend
from app.storage.local import LocalStorage


@lru_cache
def get_storage() -> StorageBackend:
    s = get_settings()
    if s.storage_backend == "s3":
        # Imported lazily so boto3 is only required when S3 is actually used.
        from app.storage.s3 import S3Storage

        return S3Storage(
            s.s3_bucket,
            endpoint_url=s.s3_endpoint_url,
            region=s.s3_region,
            access_key=s.s3_access_key,
            secret_key=s.s3_secret_key,
            public_url=s.s3_public_url,
        )
    return LocalStorage(s.local_storage_dir, s.local_storage_public_url)
