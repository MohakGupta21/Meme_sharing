from __future__ import annotations

import logging

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from app.storage.base import StorageBackend, StoredObject

log = logging.getLogger("app.storage")


def _reason(exc: Exception) -> str:
    """A short, secret-free description of a boto failure (error code / message)."""
    if isinstance(exc, ClientError):
        err = exc.response.get("Error", {})
        return err.get("Code") or err.get("Message") or "ClientError"
    return type(exc).__name__


class S3Storage(StorageBackend):
    """S3 / R2 / MinIO backend."""

    def __init__(
        self,
        bucket: str,
        *,
        endpoint_url: str | None,
        region: str,
        access_key: str | None,
        secret_key: str | None,
        public_url: str | None,
    ) -> None:
        self.bucket = bucket
        self.public_url = (public_url or "").rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url or None,
            region_name=region or None,
            aws_access_key_id=access_key or None,
            aws_secret_access_key=secret_key or None,
            config=Config(signature_version="s3v4"),
        )

    def put(self, key: str, data: bytes, content_type: str) -> StoredObject:
        try:
            self._client.put_object(
                Bucket=self.bucket, Key=key, Body=data, ContentType=content_type
            )
        except (BotoCoreError, ClientError) as exc:
            log.exception("S3 put_object failed (bucket=%s key=%s)", self.bucket, key)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Media storage rejected the upload ({_reason(exc)})",
            ) from exc
        return StoredObject(key=key, url=self.url_for(key))

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except (BotoCoreError, ClientError):
            log.exception("S3 delete_object failed (bucket=%s key=%s)", self.bucket, key)
            # Callers treat delete as best-effort; a dangling blob is harmless.

    def check(self) -> None:
        """Raise if the bucket is unreachable / misconfigured (used by /health/storage)."""
        self._client.head_bucket(Bucket=self.bucket)

    def url_for(self, key: str) -> str:
        if self.public_url:
            return f"{self.public_url}/{key}"
        return f"s3://{self.bucket}/{key}"
