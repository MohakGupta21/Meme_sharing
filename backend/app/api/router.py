from fastapi import APIRouter

from app.api.v1 import auth, chat, engagement, friends, memes, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(memes.router)
api_router.include_router(engagement.router)
api_router.include_router(friends.router)
api_router.include_router(chat.router)
