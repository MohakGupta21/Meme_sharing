"""FastAPI application factory."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.api.v1.chat import ws_router
from app.core.config import get_settings
from app.core.logging import configure_logging, request_id_var

log = logging.getLogger("app")


class MediaStatic(StaticFiles):
    """Static files for user uploads — served with sniffing disabled so a file that
    slipped past upload validation can't be interpreted as active content."""

    async def get_response(self, path: str, scope):  # type: ignore[override]
        response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
        return response


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging("DEBUG" if settings.debug else "INFO")

    app = FastAPI(title=settings.app_name, version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id", uuid.uuid4().hex)
        token = request_id_var.set(request_id)

        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit():
            if int(content_length) > settings.max_request_bytes:
                request_id_var.reset(token)
                return JSONResponse(
                    status_code=413, content={"detail": "Request body too large"}
                )
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers["x-request-id"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    @app.get("/health", tags=["meta"])
    async def health():
        return {"status": "ok"}

    @app.get("/health/db", tags=["meta"])
    async def health_db():
        from sqlalchemy import text

        from app.db.session import engine

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok"}

    @app.get("/health/storage", tags=["meta"])
    async def health_storage():
        """Verify the configured blob store is reachable — handy after switching to S3/R2."""
        import anyio

        from app.storage import get_storage

        backend = settings.storage_backend
        try:
            storage = await anyio.to_thread.run_sync(get_storage)
            await anyio.to_thread.run_sync(storage.check)
        except Exception as exc:  # noqa: BLE001 — report the reason, don't 500
            log.warning("storage health check failed: %s", exc)
            return JSONResponse(
                status_code=503,
                content={"status": "error", "backend": backend, "detail": str(exc)},
            )
        return {"status": "ok", "backend": backend}

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    app.include_router(ws_router)

    # Local storage: serve uploaded files at /media
    if settings.storage_backend == "local":
        media_dir = Path(settings.local_storage_dir)
        media_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/media", MediaStatic(directory=str(media_dir)), name="media")

    return app


app = create_app()
