# MemeShare

A social meme-sharing platform. Users sign up with a profile (picture, location, caption),
post image/video memes, like and comment, send friend requests, and chat 1:1 with friends
in real time.

- **Backend:** FastAPI + SQLAlchemy 2.0 (async) + Alembic
- **Frontend:** React 18 + Vite + TypeScript + TanStack Query + Tailwind
- **Realtime:** native WebSockets
- **Database:** SQLite for local dev (no server to install); PostgreSQL in production
- **Storage:** pluggable — local disk (dev, served at `/media`) or S3/MinIO (prod)

See [PLAN.md](PLAN.md) for the full architecture and phased build plan.
No Docker required.

---

## 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp ../.env.example .env          # defaults already point at a local SQLite file
alembic upgrade head            # creates memeshare.db
uvicorn app.main:app --reload
```

- API:  http://localhost:8000
- Docs: http://localhost:8000/docs
- `GET /health` → `{"status":"ok"}`

Uploaded media is written to `backend/media_store/` and served at
`http://localhost:8000/media/...`.

## 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                     # http://localhost:5174
```

## 3. Tests

```bash
cd backend && pytest            # spins up a throwaway SQLite db, no server needed
cd frontend && npm test
```

---

## Going to production

Set `DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname`, install the
extra Postgres/S3 dependencies, and run migrations:

```bash
pip install -e ".[prod]"
export ENVIRONMENT=production DEBUG=false
export JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export DATABASE_URL=postgresql+asyncpg://...
export STORAGE_BACKEND=s3 S3_BUCKET=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_PUBLIC_URL=...
alembic upgrade head
# NOTE: the WebSocket ConnectionManager is in-process — run a SINGLE worker until a
# Redis pub/sub adapter is added, or live chat delivery breaks across workers.
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 1 -b 0.0.0.0:8000
```

In production the app refuses to start unless `JWT_SECRET` is a strong non-default
value and `DEBUG=false` (see `app/core/config.py`). Media should be served from a
bucket/origin separate from the API; `/media` already sends `X-Content-Type-Options:
nosniff` and a locked-down CSP for the local backend.

The schema is written to work on both SQLite and PostgreSQL; the one
Postgres-specific bit (a functional unique index on friendships) is emitted with
the right syntax per dialect in the initial migration.

---

## Project layout

```
backend/app
  core/       config, security (JWT/bcrypt), deps, logging
  db/         async engine + session, declarative base
  models/     SQLAlchemy models (one file per table)
  schemas/    Pydantic request/response models
  api/v1/     routers: auth, users, memes, engagement, friends, chat
  services/   business logic
  storage/    StorageBackend ABC + local + s3 implementations
  realtime/   in-process WebSocket ConnectionManager
frontend/src
  api/        axios client + per-domain API modules
  auth/       AuthContext, useAuth, ProtectedRoute
  hooks/      useInfiniteFeed, useChatSocket
  components/ MemeCard, CommentList, UploadForm, FriendButton, Navbar
  pages/      Login, Signup, Feed, MemeDetail, Profile, EditProfile, Friends, Search, Chat
```
