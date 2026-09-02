import pytest


async def _meme(client, headers, png_bytes):
    resp = await client.post(
        "/api/v1/memes",
        headers=headers,
        files={"media": ("m.png", png_bytes, "image/png")},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_like_is_idempotent(client, register, png_bytes):
    alice = await register(client, "alice")
    meme_id = await _meme(client, alice["headers"], png_bytes)

    r1 = await client.put(f"/api/v1/memes/{meme_id}/like", headers=alice["headers"])
    r2 = await client.put(f"/api/v1/memes/{meme_id}/like", headers=alice["headers"])
    assert r1.json()["like_count"] == 1
    assert r2.json()["like_count"] == 1

    u1 = await client.delete(f"/api/v1/memes/{meme_id}/like", headers=alice["headers"])
    u2 = await client.delete(f"/api/v1/memes/{meme_id}/like", headers=alice["headers"])
    assert u1.json()["like_count"] == 0
    assert u2.json()["like_count"] == 0


@pytest.mark.asyncio
async def test_comment_count_tracks_add_and_delete(client, register, png_bytes):
    alice = await register(client, "alice")
    meme_id = await _meme(client, alice["headers"], png_bytes)

    c = await client.post(
        f"/api/v1/memes/{meme_id}/comments",
        headers=alice["headers"],
        json={"body": "lol"},
    )
    assert c.status_code == 201
    comment_id = c.json()["id"]

    meme = await client.get(f"/api/v1/memes/{meme_id}", headers=alice["headers"])
    assert meme.json()["comment_count"] == 1

    await client.delete(f"/api/v1/comments/{comment_id}", headers=alice["headers"])
    meme = await client.get(f"/api/v1/memes/{meme_id}", headers=alice["headers"])
    assert meme.json()["comment_count"] == 0


@pytest.mark.asyncio
async def test_recompute_counters_repairs_drift(client, register, png_bytes):
    from sqlalchemy import update

    from app.db.session import SessionFactory
    from app.models import Meme
    from app.services import engagement_service

    alice = await register(client, "alice")
    meme_id = await _meme(client, alice["headers"], png_bytes)
    await client.put(f"/api/v1/memes/{meme_id}/like", headers=alice["headers"])

    async with SessionFactory() as db:
        await db.execute(update(Meme).where(Meme.id == meme_id).values(like_count=99))
        await db.commit()
        touched = await engagement_service.recompute_counters(db)

    assert touched == 1
    meme = await client.get(f"/api/v1/memes/{meme_id}", headers=alice["headers"])
    assert meme.json()["like_count"] == 1


@pytest.mark.asyncio
async def test_cannot_delete_others_comment(client, register, png_bytes):
    alice = await register(client, "alice")
    bob = await register(client, "bob")
    meme_id = await _meme(client, alice["headers"], png_bytes)
    comment_id = (
        await client.post(
            f"/api/v1/memes/{meme_id}/comments",
            headers=bob["headers"],
            json={"body": "mine"},
        )
    ).json()["id"]

    carol = await register(client, "carol")
    forbidden = await client.delete(
        f"/api/v1/comments/{comment_id}", headers=carol["headers"]
    )
    assert forbidden.status_code == 403

    # meme author can moderate
    ok = await client.delete(f"/api/v1/comments/{comment_id}", headers=alice["headers"])
    assert ok.status_code == 204
