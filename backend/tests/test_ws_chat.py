"""WebSocket chat coverage — delivery, malformed frames, auth rejection."""
import pytest
from httpx import AsyncClient
from httpx_ws import aconnect_ws
from httpx_ws.transport import ASGIWebSocketTransport

from app.main import app
from tests.test_friends import _befriend

pytestmark = pytest.mark.asyncio


def _ws_client() -> AsyncClient:
    return AsyncClient(transport=ASGIWebSocketTransport(app), base_url="http://test")


async def test_ws_delivers_message_between_friends(client, register):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    await _befriend(client, alice, bob)
    conv = await client.post(
        "/api/v1/chat/conversations",
        headers=alice["headers"],
        json={"user_id": bob["user"]["id"]},
    )
    conv_id = conv.json()["id"]

    async with _ws_client() as ac:
        async with aconnect_ws(f"/ws/chat?token={bob['access_token']}", ac) as bob_ws:
            await client.post(
                f"/api/v1/chat/conversations/{conv_id}/messages",
                headers=alice["headers"],
                json={"body": "live hello"},
            )
            frame = await bob_ws.receive_json()
            assert frame["type"] == "message"
            assert frame["body"] == "live hello"


async def test_ws_malformed_frame_is_reported_not_fatal(client, register):
    alice = await register(client, "alice")
    async with _ws_client() as ac:
        async with aconnect_ws(f"/ws/chat?token={alice['access_token']}", ac) as ws:
            await ws.send_text("not json")
            assert (await ws.receive_json())["type"] == "error"
            # socket is still usable after an error
            await ws.send_json({"type": "bogus", "conversation_id": 1})
            assert (await ws.receive_json())["type"] == "error"


async def test_ws_rejects_unauthenticated():
    async with _ws_client() as ac:
        with pytest.raises(Exception):  # noqa: B017 - httpx-ws raises on the 1008 close
            async with aconnect_ws("/ws/chat", ac):
                pass
