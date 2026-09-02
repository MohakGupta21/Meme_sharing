from __future__ import annotations

from pathlib import Path

from app.storage.base import StorageBackend, StoredObject


class LocalStorage(StorageBackend):
    """Writes files under a directory that FastAPI serves as static `/media`."""

    def __init__(self, root_dir: str, public_url: str) -> None:
        self.root = Path(root_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        self.public_url = public_url.rstrip("/")

    def _path(self, key: str) -> Path:
        root = self.root.resolve()
        p = (root / key).resolve()
        if not p.is_relative_to(root):
            raise ValueError("path traversal detected")
        return p

    def put(self, key: str, data: bytes, content_type: str) -> StoredObject:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return StoredObject(key=key, url=self.url_for(key))

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def url_for(self, key: str) -> str:
        return f"{self.public_url}/{key}"
