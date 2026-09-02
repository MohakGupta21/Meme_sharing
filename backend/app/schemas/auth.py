from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserMe


class SignupForm(BaseModel):
    """Parsed from multipart form fields (the file is handled separately)."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_.]+$")
    password: str = Field(min_length=8, max_length=128)
    lives_in: str = Field(min_length=1, max_length=120)
    caption: str = Field(min_length=1, max_length=200)
    display_name: str | None = Field(default=None, max_length=80)
    bio: str | None = Field(default=None, max_length=500)


class LoginRequest(BaseModel):
    email_or_username: str
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class SignupResponse(TokenPair):
    user: UserMe
