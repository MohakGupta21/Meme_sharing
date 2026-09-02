# Meme Sharing Platform — Concrete Build Plan

## 0. Requirement Analysis (from AGENTS.md)

| # | Requirement | Feature domain | Key entities |
|---|-------------|----------------|--------------|
| 1 | Post images/videos as memes | Media + Feed | `meme`, `media_asset` |
| 2 | Comment on and like memes | Engagement | `comment`, `like` |
| 3 | Persist users + their memes + personal data | Data model | `user`, `meme` |
| 4 | Login / sign up; sign up captures profile picture, "lives in", caption | Auth + Profile | `user` |
| 5 | Separate chat module between users | Messaging | `conversation`, `message` |
| 6 | Friends = accepted friend requests | Social graph | `friendship` |
| 7 | Backend = FastAPI (Python), Frontend = React.js | Stack constraint | — |

**Non-negotiable rules derived from the requirement**
- A meme has exactly one author and one media asset (image OR video).
- A user can like a meme at most once (toggle).
- Chat is only allowed between two users who are friends (`friendship.status = accepted`).
- Sign up is invalid unless `profile_picture`, `lives_in`, and `caption` are provided.

---

## 1. Locked Tech Choices (no alternatives — pick and move)

### Backend
- Python 3.11+, **FastAPI**, Uvicorn (dev) / Gunicorn+Uvicorn workers (prod)
- **SQLAlchemy 2.0** async + **Alembic** migrations
  - **SQLite** (`aiosqlite`) for local dev and CI — zero install, no Docker
  - **PostgreSQL** (`asyncpg`) in production — set `DATABASE_URL`, `pip install -e ".[prod]"`
  - The schema and all queries are written to run on both; the one Postgres-only
    construct (a functional unique index on `friendships`) is emitted per-dialect
    in migration `0001`. Timestamps are stored as naive UTC for portability.
- **Pydantic v2** + `pydantic-settings` for config
- Auth: `python-jose[cryptography]` (JWT), `passlib[bcrypt]` (hashing)
- Uploads: `python-multipart`; image/video probing with `Pillow` + `python-magic`
- Storage: abstract `StorageBackend` interface — `LocalStorage` (dev, serves `/media`) and `S3Storage` (`boto3`, prod / MinIO)
- Realtime: native FastAPI `WebSocket`; in-process `ConnectionManager` for MVP, Redis pub/sub adapter behind the same interface for scale-out
- Tests: `pytest`, `pytest-asyncio`, `httpx.AsyncClient`, `factory-boy`, Postgres via `testcontainers` (fallback: disposable Docker db)

### Frontend
- **React 18 + Vite + TypeScript**
- Routing: `react-router-dom` v6
- Server state: **TanStack Query v5**; client state: React Context (auth only) — no Redux
- HTTP: `axios` instance with auth interceptor + refresh-on-401
- Forms: `react-hook-form` + `zod`
- Styling: **Tailwind CSS** + Headless UI
- Realtime: native `WebSocket` wrapped in a `useChatSocket` hook
- Tests: `vitest` + `@testing-library/react` + `msw` for API mocking

### Infrastructure
- **No Docker required.** Local dev: `uvicorn` + `vite` against a SQLite file and
  local-disk media storage. (A Postgres + MinIO Compose file can be reintroduced
  later for parity testing, but is not needed to run the app.)
- CI: GitHub Actions — lint (`ruff`, `eslint`), typecheck (`mypy`, `tsc`), tests (SQLite, no services)
- Prod: backend on Render/Railway/Fly.io; frontend static build on Vercel/Netlify; managed Postgres; S3 bucket (or MinIO)

---

## 2. Repository Layout

```
Meme_sharing/
├─ AGENTS.md
├─ PLAN.md
├─ docker-compose.yml
├─ .env.example
├─ README.md
├─ backend/
│  ├─ pyproject.toml
│  ├─ alembic.ini
│  ├─ alembic/
│  │  └─ versions/
│  ├─ app/
│  │  ├─ main.py                # FastAPI app factory, router include, CORS, static mount
│  │  ├─ core/
│  │  │  ├─ config.py           # Settings (env-driven)
│  │  │  ├─ security.py         # hash/verify pw, create/decode JWT
│  │  │  ├─ deps.py             # get_db, get_current_user, require_friend
│  │  │  └─ logging.py
│  │  ├─ db/
│  │  │  ├─ base.py             # DeclarativeBase, metadata
│  │  │  └─ session.py          # async engine + session factory
│  │  ├─ models/                # SQLAlchemy: user, meme, media_asset, like, comment, friendship, conversation, message
│  │  ├─ schemas/               # Pydantic request/response models per domain
│  │  ├─ api/
│  │  │  ├─ router.py           # aggregates v1 routers
│  │  │  └─ v1/
│  │  │     ├─ auth.py
│  │  │     ├─ users.py
│  │  │     ├─ memes.py
│  │  │     ├─ engagement.py    # likes + comments
│  │  │     ├─ friends.py
│  │  │     └─ chat.py          # REST + WebSocket
│  │  ├─ services/              # business logic: auth_service, meme_service, feed_service, friend_service, chat_service
│  │  ├─ storage/               # base.py, local.py, s3.py, factory.py
│  │  └─ realtime/              # connection_manager.py
│  └─ tests/
│     ├─ conftest.py
│     └─ test_*.py
└─ frontend/
   ├─ package.json
   ├─ vite.config.ts
   ├─ index.html
   └─ src/
      ├─ main.tsx
      ├─ App.tsx                # router + providers
      ├─ api/                   # axiosClient.ts + one file per domain
      ├─ auth/                  # AuthContext, ProtectedRoute, useAuth
      ├─ hooks/                 # useChatSocket, useInfiniteFeed
      ├─ components/            # MemeCard, CommentList, UploadForm, FriendButton, ...
      ├─ pages/                 # Login, Signup, Feed, MemeDetail, Profile, EditProfile, Friends, Search, Chat
      └─ types/
```

---

## 3. Database Schema (PostgreSQL DDL — the source of truth)

```sql
-- users -----------------------------------------------------------------
CREATE TABLE users (
  id                  BIGSERIAL PRIMARY KEY,
  email               CITEXT UNIQUE NOT NULL,
  username            VARCHAR(30) UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  display_name        VARCHAR(80),
  profile_picture_url TEXT NOT NULL,          -- required at signup
  lives_in            VARCHAR(120) NOT NULL,  -- required at signup
  caption             VARCHAR(200) NOT NULL,  -- required at signup
  bio                 VARCHAR(500),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- media assets --------------------------------------------------------
CREATE TABLE media_assets (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key  TEXT NOT NULL,                 -- key/path inside the storage backend
  url          TEXT NOT NULL,
  media_type   VARCHAR(10) NOT NULL CHECK (media_type IN ('image','video')),
  mime_type    VARCHAR(100) NOT NULL,
  width        INT,
  height       INT,
  duration_ms  INT,                           -- video only
  bytes        BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- memes -------------------------------------------------------------------
CREATE TABLE memes (
  id             BIGSERIAL PRIMARY KEY,
  author_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_asset_id BIGINT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  title          VARCHAR(140),
  description    VARCHAR(1000),
  like_count     INT NOT NULL DEFAULT 0,      -- denormalized counter
  comment_count  INT NOT NULL DEFAULT 0,      -- denormalized counter
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_memes_author_created ON memes(author_id, created_at DESC);
CREATE INDEX idx_memes_created        ON memes(created_at DESC);

-- likes (one per user per meme) -----------------------------------------
CREATE TABLE likes (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meme_id    BIGINT NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, meme_id)
);

-- comments -------------------------------------------------------------
CREATE TABLE comments (
  id         BIGSERIAL PRIMARY KEY,
  meme_id    BIGINT NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
  author_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_meme_created ON comments(meme_id, created_at);

-- friendships (one row per pair, requester_id < receiver_id enforced in service) --
CREATE TABLE friendships (
  id           BIGSERIAL PRIMARY KEY,
  requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(10) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','declined','blocked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> receiver_id),
  UNIQUE (requester_id, receiver_id)
);
CREATE UNIQUE INDEX uq_friendship_pair
  ON friendships (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));

-- conversations (exactly two participants for MVP) --------------------
CREATE TABLE conversations (
  id         BIGSERIAL PRIMARY KEY,
  user_a_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- always the lower id
  user_b_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- always the higher id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

-- messages -----------------------------------------------------------------
CREATE TABLE messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            VARCHAR(4000) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ
);
CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at DESC);
```

Counters (`like_count`, `comment_count`) are updated in the same DB transaction as the
like/comment write. A nightly reconciliation job (or an admin endpoint) recomputes them.

---

## 4. API Contract (REST, prefix `/api/v1`)

All protected routes require `Authorization: Bearer <access_token>`.
Standard error body: `{"detail": "<message>"}`. List endpoints are cursor-paginated:
`?limit=20&cursor=<opaque>` → `{"items": [...], "next_cursor": "<opaque|null>"}`.

### Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/signup` | multipart: `email, username, password, lives_in, caption, display_name?, bio?, profile_picture(file)` | `201 {user, access_token, refresh_token}` |
| POST | `/auth/login` | `{email_or_username, password}` | `200 {access_token, refresh_token}` |
| POST | `/auth/refresh` | `{refresh_token}` | `200 {access_token}` |
| POST | `/auth/logout` | `{refresh_token}` | `204` (revokes refresh token) |

Access token TTL 15 min; refresh token TTL 30 days, stored hashed in a `refresh_tokens` table (added in Phase 3), rotated on use.

### Users / Profile
| Method | Path | Notes |
|---|---|---|
| GET | `/users/me` | current profile + `meme_count`, `friend_count` |
| PATCH | `/users/me` | update `display_name, bio, lives_in, caption` |
| PUT | `/users/me/profile-picture` | multipart file → new `profile_picture_url` |
| GET | `/users/{id}` | public profile + `friendship_status` relative to caller |
| GET | `/users?search=<q>` | username / display_name search, paginated |

### Memes
| Method | Path | Notes |
|---|---|---|
| POST | `/memes` | multipart: `media(file), title?, description?`; server derives `media_type` |
| GET | `/memes/feed` | memes by caller + accepted friends, newest first, paginated; each item includes `liked_by_me` |
| GET | `/memes/{id}` | single meme + author + counts + `liked_by_me` |
| GET | `/users/{id}/memes` | a user's memes, paginated |
| DELETE | `/memes/{id}` | author only |

### Engagement
| Method | Path | Notes |
|---|---|---|
| PUT | `/memes/{id}/like` | idempotent like; returns `{like_count, liked_by_me:true}` |
| DELETE | `/memes/{id}/like` | idempotent unlike |
| GET | `/memes/{id}/comments` | paginated |
| POST | `/memes/{id}/comments` | `{body}` → `201 comment` |
| DELETE | `/comments/{id}` | comment author or meme author |

### Friends
| Method | Path | Notes |
|---|---|---|
| POST | `/friends/requests` | `{user_id}`; rejects self / duplicate / already-friends |
| GET | `/friends/requests?direction=incoming\|outgoing` | pending requests |
| POST | `/friends/requests/{id}/accept` | receiver only → status `accepted`, auto-create conversation |
| POST | `/friends/requests/{id}/decline` | receiver only |
| GET | `/friends` | accepted friends, paginated |
| DELETE | `/friends/{user_id}` | unfriend |

### Chat
| Method | Path | Notes |
|---|---|---|
| GET | `/chat/conversations` | list with last message + unread count, sorted by `last_message_at` |
| GET | `/chat/conversations/{id}/messages` | paginated, newest first |
| POST | `/chat/conversations/{id}/messages` | `{body}` → persists + broadcasts over WS; REST fallback when socket down |
| POST | `/chat/conversations` | `{user_id}` — get-or-create; **403 unless friends** |
| WS | `/ws/chat?token=<access_token>` | one socket per user; server routes messages to the recipient's socket(s) |

**WebSocket protocol (JSON frames)**
- client → server: `{"type":"message","conversation_id":123,"body":"..."}`, `{"type":"read","conversation_id":123}`, `{"type":"typing","conversation_id":123}`
- server → client: `{"type":"message", ...message}`, `{"type":"read","conversation_id":123,"user_id":9}`, `{"type":"typing", ...}`, `{"type":"error","detail":"..."}`

---

## 5. Phased Implementation — steps with deliverables & acceptance criteria

Each step ends with committed code, passing tests, and a runnable state.

### Phase 0 — Scaffolding (½ day)
1. Create repo layout from §2; add `.gitignore`, `.env.example`, `README.md`.
2. `docker-compose.yml` with `postgres`, `minio`, `createbuckets` init job.
3. `backend/pyproject.toml` (deps + `ruff`, `mypy`, `pytest` config); `frontend` via `npm create vite@latest frontend -- --template react-ts`.
4. **Accept:** `docker compose up` brings up Postgres + MinIO; `uvicorn app.main:app` serves `GET /health` → `{"status":"ok"}`; `npm run dev` serves the Vite starter.

### Phase 1 — Backend foundation (1 day)
5. `core/config.py` Settings; `db/session.py` async engine; `db/base.py`.
6. `main.py` app factory: CORS (frontend origin from env), `/api/v1` router include, static `/media` mount, exception handlers, request-id + structured logging.
7. Alembic init; `models/` for all 8 tables from §3; generate migration `0001_initial`; `alembic upgrade head`.
8. `storage/` — `StorageBackend` ABC, `LocalStorage`, `S3Storage`, `factory.get_storage()` from env.
9. `tests/conftest.py` — throwaway Postgres, `AsyncClient` fixture, `user_factory`.
10. **Accept:** migrations create every table; `pytest` runs green with 1 smoke test; uploading a file via a scratch endpoint lands in MinIO and returns a URL.

### Phase 2 — Auth & profiles (1.5 days)
11. `core/security.py` (bcrypt hash/verify, JWT encode/decode); `refresh_tokens` table + migration.
12. `services/auth_service.py`; `api/v1/auth.py` — signup (validates the 3 required profile fields + parses `profile_picture` upload), login, refresh, logout.
13. `core/deps.py` — `get_current_user`, `get_current_user_ws` (token from query param).
14. `api/v1/users.py` — `/users/me` (GET/PATCH), profile-picture upload, `/users/{id}`, user search.
15. **Tests:** signup rejects missing `lives_in`/`caption`/`profile_picture`; duplicate email/username → 409; login wrong password → 401; expired access token → 401; refresh rotation works.
16. **Accept:** full signup→login→`/users/me` cycle passes end to end against real Postgres + MinIO.

### Phase 3 — Memes & feed (1.5 days)
17. `services/meme_service.py` — validate MIME/type via `python-magic`, size cap (env: image 10 MB, video 50 MB), probe dimensions/duration, store asset, create meme row.
18. `services/feed_service.py` — feed = memes where `author_id IN (caller + accepted friends)`, keyset pagination on `(created_at, id)`, batch-annotate `liked_by_me`.
19. `api/v1/memes.py` — POST, feed, get-by-id, list-by-user, delete.
20. **Tests:** reject `.txt` upload; reject oversized file; feed excludes non-friends; feed pagination returns no duplicates/gaps; deleting a meme cascades likes/comments.
21. **Accept:** authenticated user uploads an image and a video, both appear in their own feed and a friend's feed.

### Phase 4 — Likes & comments (1 day)
22. `services/engagement_service.py` — like/unlike idempotent, counter update in the same transaction (`INSERT ... ON CONFLICT DO NOTHING`); comment create/list/delete with permission check.
23. `api/v1/engagement.py`.
24. **Tests:** double-like keeps `like_count` at 1; unlike twice stays at 0; `comment_count` tracks add/delete; non-author cannot delete someone else's comment (unless meme author).
25. **Accept:** counters on `GET /memes/{id}` stay correct through a like/unlike/comment/delete sequence.

### Phase 5 — Friends (1 day)
26. `services/friend_service.py` — normalize pair ordering, block self-request, block duplicate/inverse pending, block if already accepted; accept → set `accepted` + get-or-create conversation atomically.
27. `api/v1/friends.py` — request, list incoming/outgoing, accept, decline, list friends, unfriend.
28. **Tests:** self-request → 400; A→B then B→A duplicate → 409; accept creates exactly one conversation; unfriend removes friendship but keeps conversation history.
29. **Accept:** A and B become friends and a conversation exists for them.

### Phase 6 — Chat (2 days)
30. `realtime/connection_manager.py` — `user_id → set[WebSocket]`; `connect`, `disconnect`, `send_to_user`. Interface allows a later Redis pub/sub implementation.
31. `services/chat_service.py` — get-or-create conversation (**403 unless friends**), persist message + bump `last_message_at`, mark-read, unread counts.
32. `api/v1/chat.py` — REST endpoints + `WS /ws/chat`: authenticate via token, register socket, loop over frames, validate sender is a participant, persist, broadcast to recipient + echo to sender's other sockets.
33. **Tests:** non-friends → 403 on conversation create and message POST; message persisted is delivered to a connected recipient (use `AsyncClient` websocket test client); reconnect replays nothing but history endpoint returns all; malformed frame → `{"type":"error"}` without dropping the socket.
34. **Accept:** two test clients exchange live messages; history survives reconnect.

### Phase 7 — Frontend foundation (1 day)
35. Tailwind + router + providers (`QueryClientProvider`, `AuthProvider`); `api/axiosClient.ts` with request interceptor (attach token) + response interceptor (401 → refresh → retry once → else logout).
36. `AuthContext` (token in memory + refresh token in `localStorage`), `ProtectedRoute`, app shell (nav bar, routes).
37. **Accept:** unauthenticated visit to `/feed` redirects to `/login`.

### Phase 8 — Frontend auth & profile (1 day)
38. `pages/Signup` (react-hook-form + zod, file input with preview, all required fields enforced client-side), `pages/Login`.
39. `pages/Profile` (own + others, shows `friendship_status` and the right action button), `pages/EditProfile`, profile-picture change.
40. **Accept:** sign up in the browser → land on feed authenticated; edit profile persists after reload.

### Phase 9 — Frontend feed & engagement (1.5 days)
41. `hooks/useInfiniteFeed` (TanStack `useInfiniteQuery`), `pages/Feed`, `components/MemeCard` (renders `<img>` or `<video>`), `components/UploadForm` (modal, progress).
42. `pages/MemeDetail`, `components/CommentList` + add-comment box; like button with optimistic update + rollback on error.
43. **Accept:** upload a meme from the UI, see it at the top of the feed, like it (count updates instantly), add a comment.

### Phase 10 — Frontend friends & search (1 day)
44. `pages/Search` (user search), `components/FriendButton` (state machine: none → requested → incoming(accept/decline) → friends → unfriend), `pages/Friends` (friends list + incoming/outgoing requests tabs).
45. **Accept:** send a request, accept it from the other account, both see each other in Friends.

### Phase 11 — Frontend chat (1.5 days)
46. `hooks/useChatSocket` — open `WS /ws/chat?token=`, auto-reconnect with backoff, expose `sendMessage`, `messages`, `typing`.
47. `pages/Chat` — conversation list sidebar (unread badges) + message thread pane + composer; new-message and read receipts update live; falls back to REST POST if socket is closed.
48. **Accept:** two browsers, two accounts (friends) chat in real time; unread badge clears on open.

### Phase 12 — Hardening (1.5 days)
49. Rate limiting (`slowapi`): login 5/min/IP, signup 3/hour/IP, meme upload 20/hour/user, comment 60/hour/user.
50. Input hardening: Pydantic constraints everywhere, strip/limit text fields, `python-magic` content sniffing on every upload, reject SVG, filename sanitization, max request body size at the ASGI layer.
51. Security headers + strict CORS allowlist; secrets only from env; never log tokens; `SELECT ... FOR UPDATE` or `ON CONFLICT` on all counter/like paths.
52. Pagination and `N+1` review on feed, comments, conversations (use `selectinload`).
53. **Accept:** load test feed at 500 memes stays < 200 ms p95 locally; OWASP-style quick pass (authz on every route, no IDOR on `/memes/{id}`, `/comments/{id}`, `/friends/requests/{id}`).

### Phase 13 — Testing & CI (1 day)
54. Backend coverage ≥ 80% on services + API; add contract tests for every endpoint in §4.
55. Frontend: Vitest + RTL for `MemeCard`, `FriendButton` state machine, login/signup forms, chat message list; `msw` handlers mirror §4.
56. GitHub Actions: `lint → typecheck → backend tests (with Postgres service) → frontend tests → build`.
57. **Accept:** CI green on a clean checkout; `docker compose -f docker-compose.yml up` runs the whole stack.

### Phase 14 — Deployment (1 day)
58. Backend `Dockerfile` (multi-stage, non-root, Gunicorn+Uvicorn workers), `entrypoint.sh` runs `alembic upgrade head` then serves.
59. Provision managed Postgres + S3 bucket (or hosted MinIO); set env vars; run migration.
60. Deploy backend container; deploy frontend static build (`VITE_API_BASE_URL`, `VITE_WS_URL` baked at build).
61. Monitoring: Sentry (backend + frontend), `/health` + `/health/db` probes, structured JSON logs, uptime check, storage-upload failure alert.
62. **Accept:** production smoke test — signup, upload, like, comment, friend, chat all work against the deployed URLs.

---

## 6. MVP Cut Line

Ship Phases 0–11 + the security items in Phase 12. Defer: video transcoding/thumbnails,
push notifications, group chat, feed ranking beyond recency, blocking/reporting,
email verification, admin tools. Redis-backed WebSocket fan-out is only needed when
running more than one backend replica.

---

## 7. Build Order Summary

```
0 Scaffold → 1 Backend base → 2 Auth/Profile → 3 Memes/Feed → 4 Likes/Comments
→ 5 Friends → 6 Chat(API+WS) → 7 FE base → 8 FE auth → 9 FE feed → 10 FE friends
→ 11 FE chat → 12 Harden → 13 Tests/CI → 14 Deploy
```

Estimated ~20 working days for one full-stack developer to a deployed MVP.

---

## 8. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Duplicate likes / friend requests under concurrency | DB unique constraints + `ON CONFLICT` / pair-normalized unique index; never rely on app checks alone |
| Feed query slows down with volume | Keyset pagination, `idx_memes_author_created`, batch-load `liked_by_me`, cap page size |
| Malicious uploads | Content sniffing with `python-magic`, extension allowlist, size caps, reject SVG, serve media from a separate origin/bucket |
| WebSocket state lost on multi-replica deploy | Keep `ConnectionManager` behind an interface; add Redis pub/sub before scaling out |
| Token leakage | Short access TTL, refresh rotation + revocation table, tokens never logged, HTTPS only |
| Counter drift (`like_count`/`comment_count`) | Update in same transaction as the write; scheduled reconciliation job |
| Chat allowed between non-friends | Enforce `friendship.status = accepted` in `chat_service` on both REST and WS paths, covered by tests |
