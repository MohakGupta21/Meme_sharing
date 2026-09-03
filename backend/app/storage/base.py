from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass(frozen=True)
class StoredObject:
    key: str
    url: str


class StorageBackend(abc.ABC):
    """Pluggable blob storage. Implementations must be safe to call from async code
    (they may block briefly; callers should offload with anyio.to_thread if needed)."""

    @abc.abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> StoredObject: ...

    @abc.abstractmethod
    def delete(self, key: str) -> None: ...

    @abc.abstractmethod
    def url_for(self, key: str) -> str: ...

    def check(self) -> None:  # noqa: B027 — optional hook; override where it can fail
        """Verify the backend is reachable/usable (used by /health/storage)."""
