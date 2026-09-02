from __future__ import annotations

import boto3
from botocore.client import Config

from app.storage.base import StorageBackend, StoredObject


class S3Storage(StorageBackend):
    """S3 / MinIO backend."""

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
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4"),
        )

    def put(self, key: str, data: bytes, content_type: str) -> StoredObject:
        self._client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return StoredObject(key=key, url=self.url_for(key))

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=key)

    def url_for(self, key: str) -> str:
        if self.public_url:
            return f"{self.public_url}/{key}"
        return f"s3://{self.bucket}/{key}"
