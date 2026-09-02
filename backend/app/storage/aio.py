"""Async wrappers around the (blocking) storage backend.

`LocalStorage` writes to disk and `S3Storage` makes blocking boto3 calls; either
would stall the event loop if awaited directly from a request handler, so route all
request-path storage I/O through these helpers.
"""
from __future__ import annotations

import anyio

from app.storage import StoredObject, get_storage


async def put(key: str, data: bytes, content_type: str) -> StoredObject:
    return await anyio.to_thread.run_sync(get_storage().put, key, data, content_type)


async def delete(key: str) -> None:
    await anyio.to_thread.run_sync(get_storage().delete, key)
