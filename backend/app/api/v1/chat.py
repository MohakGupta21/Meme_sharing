from __future__ import annotations

import logging

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import ValidationError

from app.core.deps import CurrentUser, DbDep, PageDep, get_current_user_ws
from app.db.session import SessionFactory
from app.models import User
from app.realtime import manager
from app.schemas.chat import (
    ConversationCreate,
    ConversationOut,
    MessageCreate,
    MessageOut,
)
from app.schemas.common import Page
from app.services import chat_service

log = logging.getLogger("app.chat")

router = APIRouter(prefix="/chat", tags=["chat"])
ws_router = APIRouter()


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(db: DbDep, current: CurrentUser):
    return await chat_service.list_conversations(db, current.id)


@router.post(
    "/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED
)
async def open_conversation(db: DbDep, current: CurrentUser, payload: ConversationCreate):
    await chat_service.open_conversation(db, current.id, payload.user_id)
    for conv in await chat_service.list_conversations(db, current.id):
        if conv.other_user.id == payload.user_id:
            return conv
    raise HTTPException(status_code=500, detail="conversation not found after creation")


@router.get("/conversations/{conversation_id}/messages", response_model=Page[MessageOut])
async def list_messages(
    db: DbDep, current: CurrentUser, page: PageDep, conversation_id: int
):
    rows, next_cursor = await chat_service.list_messages(
        db, conversation_id, current.id, page.limit, page.cursor
    )
    return Page(items=[MessageOut.model_validate(m) for m in rows], next_cursor=next_cursor)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def post_message(
    db: DbDep, current: CurrentUser, conversation_id: int, payload: MessageCreate
):
    msg, recipient_id = await chat_service.send_message(
        db, conversation_id, current.id, payload.body
    )
    out = MessageOut.model_validate(msg)
    frame = {"type": "message", **out.model_dump(mode="json")}
    await manager.send_to_user(recipient_id, frame)
    await manager.send_to_user(current.id, frame)
    return out


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(db: DbDep, current: CurrentUser, conversation_id: int):
    await chat_service.mark_read(db, conversation_id, current.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@ws_router.websocket("/ws/chat")
async def chat_socket(websocket: WebSocket, user: User = Depends(get_current_user_ws)):
    await manager.connect(user.id, websocket)
    try:
        while True:
            try:
                raw = await websocket.receive_json()
            except (ValueError, TypeError):
                await websocket.send_json({"type": "error", "detail": "malformed frame"})
                continue

            kind = raw.get("type")
            conversation_id = raw.get("conversation_id")
            if not isinstance(conversation_id, int):
                await websocket.send_json({"type": "error", "detail": "conversation_id required"})
                continue

            async with SessionFactory() as db:
                try:
                    if kind == "message":
                        body = MessageCreate(body=raw.get("body", "")).body
                        msg, recipient_id = await chat_service.send_message(
                            db, conversation_id, user.id, body
                        )
                        frame = {
                            "type": "message",
                            **MessageOut.model_validate(msg).model_dump(mode="json"),
                        }
                        await manager.send_to_user(recipient_id, frame)
                        await manager.send_to_user(user.id, frame)
                    elif kind == "read":
                        await chat_service.mark_read(db, conversation_id, user.id)
                        conv = await chat_service._load_conversation(
                            db, conversation_id, user.id
                        )
                        await manager.send_to_user(
                            conv.other_user_id(user.id),
                            {
                                "type": "read",
                                "conversation_id": conversation_id,
                                "user_id": user.id,
                            },
                        )
                    elif kind == "typing":
                        conv = await chat_service._load_conversation(db, conversation_id, user.id)
                        await manager.send_to_user(
                            conv.other_user_id(user.id),
                            {
                                "type": "typing",
                                "conversation_id": conversation_id,
                                "user_id": user.id,
                            },
                        )
                    else:
                        await websocket.send_json(
                            {"type": "error", "detail": f"unknown type: {kind}"}
                        )
                except ValidationError:
                    await websocket.send_json(
                        {"type": "error", "detail": "invalid message body"}
                    )
                except HTTPException as exc:  # 403 non-friend, 404 not a participant, ...
                    await websocket.send_json({"type": "error", "detail": str(exc.detail)})
    except WebSocketDisconnect:
        pass
    except Exception:
        # A genuine bug — log it and let the socket close rather than pretending it's fine.
        log.exception("chat socket error (user %s)", user.id)
        raise
    finally:
        await manager.disconnect(user.id, websocket)
