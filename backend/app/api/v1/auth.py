from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.deps import DbDep
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    SignupForm,
    SignupResponse,
    TokenPair,
)
from app.schemas.user import UserMe
from app.services import auth_service, meme_service
from app.storage import aio as storage

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    db: DbDep,
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    lives_in: str = Form(...),
    caption: str = Form(...),
    display_name: str | None = Form(None),
    bio: str | None = Form(None),
    profile_picture: UploadFile = File(...),
):
    try:
        form = SignupForm(
            email=email,
            username=username,
            password=password,
            lives_in=lives_in,
            caption=caption,
            display_name=display_name,
            bio=bio,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    data = await profile_picture.read()
    mime, ext = meme_service.validate_avatar(data, get_settings().max_image_bytes)
    key = f"avatars/{uuid.uuid4().hex}.{ext}"
    stored = await storage.put(key, data, mime)

    try:
        user, access, refresh = await auth_service.signup(db, form, stored.url)
    except Exception:
        await storage.delete(stored.key)  # signup failed — don't leave an orphan avatar
        raise
    return SignupResponse(
        access_token=access,
        refresh_token=refresh,
        user=UserMe.model_validate(user),
    )


@router.post("/login", response_model=TokenPair)
async def login(db: DbDep, payload: LoginRequest):
    access, refresh = await auth_service.login(db, payload.email_or_username, payload.password)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
async def refresh(db: DbDep, payload: RefreshRequest):
    access, new_refresh = await auth_service.refresh_access(db, payload.refresh_token)
    return TokenPair(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(db: DbDep, payload: RefreshRequest):
    await auth_service.logout(db, payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
