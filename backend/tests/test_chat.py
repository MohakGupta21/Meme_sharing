import pytest

from tests.test_friends import _befriend


@pytest.mark.asyncio
async def test_non_friends_cannot_open_conversation(client, register):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    resp = await client.post(
        "/api/v1/chat/conversations",
        headers=alice["headers"],
        json={"user_id": bob["user"]["id"]},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_friends_can_message_via_rest_and_history_persists(client, register):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    await _befriend(client, alice, bob)

    conv = await client.post(
        "/api/v1/chat/conversations",
        headers=alice["headers"],
        json={"user_id": bob["user"]["id"]},
    )
    conv_id = conv.json()["id"]

    send = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=alice["headers"],
        json={"body": "hey bob"},
    )
    assert send.status_code == 201

    history = await client.get(
        f"/api/v1/chat/conversations/{conv_id}/messages", headers=bob["headers"]
    )
    bodies = [m["body"] for m in history.json()["items"]]
    assert bodies == ["hey bob"]


@pytest.mark.asyncio
async def test_unread_count_and_mark_read(client, register):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    await _befriend(client, alice, bob)
    conv = await client.post(
        "/api/v1/chat/conversations",
        headers=alice["headers"],
        json={"user_id": bob["user"]["id"]},
    )
    conv_id = conv.json()["id"]
    await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=alice["headers"],
        json={"body": "unread please"},
    )

    convs = await client.get("/api/v1/chat/conversations", headers=bob["headers"])
    assert convs.json()[0]["unread_count"] == 1

    await client.post(f"/api/v1/chat/conversations/{conv_id}/read", headers=bob["headers"])
    convs = await client.get("/api/v1/chat/conversations", headers=bob["headers"])
    assert convs.json()[0]["unread_count"] == 0
