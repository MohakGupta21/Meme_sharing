import pytest


@pytest.mark.asyncio
async def test_signup_login_me(client, register):
    body = await register(client, "alice")
    assert body["user"]["username"] == "alice"
    assert body["user"]["lives_in"] == "Berlin"

    login = await client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "alice", "password": "supersecret123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"


@pytest.mark.asyncio
async def test_signup_requires_profile_fields(client, png_bytes):
    resp = await client.post(
        "/api/v1/auth/signup",
        data={"email": "b@example.com", "username": "bob", "password": "supersecret123"},
        files={"profile_picture": ("a.png", png_bytes, "image/png")},
    )
    assert resp.status_code == 422  # missing lives_in / caption


@pytest.mark.asyncio
async def test_signup_requires_picture(client):
    resp = await client.post(
        "/api/v1/auth/signup",
        data={
            "email": "c@example.com",
            "username": "carol",
            "password": "supersecret123",
            "lives_in": "NYC",
            "caption": "hi",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_username_conflicts(client, register, png_bytes):
    await register(client, "dave")
    resp = await client.post(
        "/api/v1/auth/signup",
        data={
            "email": "dave2@example.com",
            "username": "dave",
            "password": "supersecret123",
            "lives_in": "NYC",
            "caption": "hi",
        },
        files={"profile_picture": ("a.png", png_bytes, "image/png")},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_signup_rejects_non_image_avatar(client):
    resp = await client.post(
        "/api/v1/auth/signup",
        data={
            "email": "mallory@example.com",
            "username": "mallory",
            "password": "supersecret123",
            "lives_in": "NYC",
            "caption": "hi",
        },
        files={"profile_picture": ("x.png", b"<script>alert(1)</script>", "image/png")},
    )
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_login_wrong_password(client, register):
    await register(client, "erin")
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email_or_username": "erin", "password": "wrong"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rotation(client, register):
    body = await register(client, "frank")
    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert r1.status_code == 200
    new_refresh = r1.json()["refresh_token"]
    assert new_refresh != body["refresh_token"]
    # old refresh token is now revoked
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_bad_access_token_rejected(client):
    resp = await client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert resp.status_code == 401
