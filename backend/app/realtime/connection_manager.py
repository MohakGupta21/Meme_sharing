"""In-process WebSocket registry: user_id -> set of live sockets.

Single-process only. To scale horizontally, implement the same public surface
(`connect` / `disconnect` / `send_to_user`) on top of Redis pub/sub and swap the
`manager` singleton.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._sockets[user_id].add(ws)

    async def disconnect(self, user_id: int, ws: WebSocket) -> None:
        async with self._lock:
            self._sockets.get(user_id, set()).discard(ws)
            if not self._sockets.get(user_id):
                self._sockets.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        targets = list(self._sockets.get(user_id, set()))
        for ws in targets:
            try:
                await ws.send_json(payload)
            except Exception:
                await self.disconnect(user_id, ws)

    def is_online(self, user_id: int) -> bool:
        return bool(self._sockets.get(user_id))


manager = ConnectionManager()
