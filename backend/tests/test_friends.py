import pytest


async def _befriend(client, a, b):
    """a sends request to b, b accepts. Returns nothing."""
    req = await client.post(
        "/api/v1/friends/requests", headers=a["headers"], json={"user_id": b["user"]["id"]}
    )
    assert req.status_code == 201, req.text
    incoming = await client.get(
        "/api/v1/friends/requests?direction=incoming", headers=b["headers"]
    )
    request_id = incoming.json()[0]["id"]
    acc = await client.post(
        f"/api/v1/friends/requests/{request_id}/accept", headers=b["headers"]
    )
    assert acc.status_code == 200


@pytest.mark.asyncio
async def test_cannot_friend_self(client, register):
    alice = await register(client, "alice")
    resp = await client.post(
        "/api/v1/friends/requests",
        headers=alice["headers"],
        json={"user_id": alice["user"]["id"]},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_duplicate_request_conflicts(client, register):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    r1 = await client.post(
        "/api/v1/friends/requests", headers=alice["headers"], json={"user_id": bob["user"]["id"]}
    )
    assert r1.status_code == 201
    r2 = await client.post(
        "/api/v1/friends/requests", headers=bob["headers"], json={"user_id": alice["user"]["id"]}
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_accept_creates_conversation_and_enables_chat(client, register):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    await _befriend(client, alice, bob)

    convs = await client.get("/api/v1/chat/conversations", headers=alice["headers"])
    assert len(convs.json()) == 1
    assert convs.json()[0]["other_user"]["username"] == "bob"


@pytest.mark.asyncio
async def test_unfriend_keeps_conversation_history(client, register):
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
        json={"body": "before the fallout"},
    )

    unfriend = await client.delete(
        f"/api/v1/friends/{bob['user']['id']}", headers=alice["headers"]
    )
    assert unfriend.status_code == 204

    # history is still readable...
    history = await client.get(
        f"/api/v1/chat/conversations/{conv_id}/messages", headers=alice["headers"]
    )
    assert [m["body"] for m in history.json()["items"]] == ["before the fallout"]
    # ...but new messages are refused now that they're not friends
    blocked = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        headers=alice["headers"],
        json={"body": "still there?"},
    )
    assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_friends_list_mutual(client, register):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    await _befriend(client, alice, bob)

    a_friends = await client.get("/api/v1/friends", headers=alice["headers"])
    b_friends = await client.get("/api/v1/friends", headers=bob["headers"])
    assert [f["username"] for f in a_friends.json()["items"]] == ["bob"]
    assert [f["username"] for f in b_friends.json()["items"]] == ["alice"]
