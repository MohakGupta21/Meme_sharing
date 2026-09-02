import pytest


async def _post_meme(client, headers, png_bytes, title="hello"):
    return await client.post(
        "/api/v1/memes",
        headers=headers,
        data={"title": title},
        files={"media": ("m.png", png_bytes, "image/png")},
    )


@pytest.mark.asyncio
async def test_upload_and_feed(client, register, png_bytes):
    alice = await register(client, "alice")
    resp = await _post_meme(client, alice["headers"], png_bytes)
    assert resp.status_code == 201, resp.text
    meme = resp.json()
    assert meme["media"]["media_type"] == "image"

    feed = await client.get("/api/v1/memes/feed", headers=alice["headers"])
    assert feed.status_code == 200
    assert [m["id"] for m in feed.json()["items"]] == [meme["id"]]


@pytest.mark.asyncio
async def test_feed_pagination_no_dupes_no_gaps(client, register, png_bytes):
    alice = await register(client, "alice")
    posted = []
    for i in range(7):
        r = await _post_meme(client, alice["headers"], png_bytes, title=f"m{i}")
        posted.append(r.json()["id"])

    seen: list[int] = []
    cursor = None
    for _ in range(10):
        url = "/api/v1/memes/feed?limit=3" + (f"&cursor={cursor}" if cursor else "")
        page = (await client.get(url, headers=alice["headers"])).json()
        seen.extend(m["id"] for m in page["items"])
        cursor = page["next_cursor"]
        if not cursor:
            break

    assert sorted(seen) == sorted(posted)          # every meme, exactly once
    assert seen == sorted(seen, reverse=True)      # newest-first ordering holds across pages


@pytest.mark.asyncio
async def test_reject_non_media_upload(client, register):
    alice = await register(client, "alice")
    resp = await client.post(
        "/api/v1/memes",
        headers=alice["headers"],
        files={"media": ("notes.txt", b"just some text", "text/plain")},
    )
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_feed_excludes_non_friends(client, register, png_bytes):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    await _post_meme(client, bob["headers"], png_bytes)

    feed = await client.get("/api/v1/memes/feed", headers=alice["headers"])
    assert feed.json()["items"] == []


@pytest.mark.asyncio
async def test_delete_meme_author_only(client, register, png_bytes):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    meme_id = (await _post_meme(client, alice["headers"], png_bytes)).json()["id"]

    forbidden = await client.delete(f"/api/v1/memes/{meme_id}", headers=bob["headers"])
    assert forbidden.status_code == 403

    ok = await client.delete(f"/api/v1/memes/{meme_id}", headers=alice["headers"])
    assert ok.status_code == 204
