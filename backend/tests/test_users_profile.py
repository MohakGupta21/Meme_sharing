import pytest


@pytest.mark.asyncio
async def test_patch_me_updates_and_rejects_null_required(client, register):
    alice = await register(client, "alice")

    ok = await client.patch(
        "/api/v1/users/me",
        headers=alice["headers"],
        json={"caption": "new caption", "bio": "hello"},
    )
    assert ok.status_code == 200
    assert ok.json()["caption"] == "new caption"

    bad = await client.patch(
        "/api/v1/users/me", headers=alice["headers"], json={"lives_in": None}
    )
    assert bad.status_code == 422

    # a nullable field can still be cleared
    clear_bio = await client.patch(
        "/api/v1/users/me", headers=alice["headers"], json={"bio": None}
    )
    assert clear_bio.status_code == 200
    assert clear_bio.json()["bio"] is None


@pytest.mark.asyncio
async def test_avatar_upload_replaces_url(client, register, png_bytes):
    alice = await register(client, "alice")
    before = (await client.get("/api/v1/users/me", headers=alice["headers"])).json()
    resp = await client.put(
        "/api/v1/users/me/profile-picture",
        headers=alice["headers"],
        files={"file": ("new.png", png_bytes, "image/png")},
    )
    assert resp.status_code == 200
    assert resp.json()["profile_picture_url"] != before["profile_picture_url"]


@pytest.mark.asyncio
async def test_avatar_upload_rejects_non_image(client, register):
    alice = await register(client, "alice")
    resp = await client.put(
        "/api/v1/users/me/profile-picture",
        headers=alice["headers"],
        files={"file": ("evil.png", b"not really an image", "image/png")},
    )
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_user_search_pagination_no_dupes(client, register):
    caller = await register(client, "caller")
    for i in range(7):
        await register(client, f"seeker{i}")

    seen: list[int] = []
    cursor = None
    for _ in range(10):
        params = {"search": "seeker", "limit": 3}
        if cursor:
            params["cursor"] = cursor
        page = await client.get(
            "/api/v1/users", headers=caller["headers"], params=params
        )
        body = page.json()
        seen.extend(u["id"] for u in body["items"])
        cursor = body["next_cursor"]
        if not cursor:
            break

    assert len(seen) == 7
    assert len(set(seen)) == 7  # no duplicates, no gaps
