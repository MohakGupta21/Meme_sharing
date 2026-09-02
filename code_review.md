# MemeShare — Comprehensive Code Review

**Date:** 2026-09-02
**Scope:** entire repository (`backend/`, `frontend/`, infra, tests)
**Reviewer:** automated deep review

---

## ✅ Resolution status (fixes applied 2026-09-02)

Every 🔴 High, 🟠 Medium, and 🟡 Low finding below has been addressed.

| Check | Before | After |
|---|---|---|
| `ruff` (backend) | clean | clean |
| `mypy app` | clean | clean (52 files) |
| `pytest` (backend) | 22 passed | **33 passed**, coverage **88.5%** (CI gate `--cov-fail-under=80`) |
| `tsc -b` (frontend) | clean | clean |
| `vitest` (frontend) | 7 passed | **8 passed** |
| `npm audit` | 6 (1 crit, 1 high) | **0 vulnerabilities** |

**Highlights of what changed**

- **H1** — documented the deliberate *public meme* visibility model in `feed_service`
  + `SECURITY.md`; the feed is a discovery filter, not an access boundary.
- **H2** — `get_or_create_conversation` now uses a `SAVEPOINT` (`begin_nested`) so a
  conversation-creation race no longer rolls back the caller's friendship change.
- **H3** — the unhandled-exception handler now `log.exception`s before returning 500;
  request-id is bound to a logging `contextvar` and appears in every JSON log line.
- **H4** — `LocalStorage._path` uses `Path.is_relative_to` (the old `startswith` guard
  was bypassable by sibling directories).
- **H5** — `useChatSocket` clears its reconnect timer on unmount and `connect()` bails
  when closed — no more zombie sockets after leaving `/chat`.
- **H6** — `AuthContext` subscribes to `tokenStore`; a failed refresh now drops the
  user and the app redirects to `/login` (regression-tested).
- **M1** — user-search pagination fixed (ordered *and* paged by `(lower(username), id)`
  with a row-value cursor); a no-dupes/no-gaps test was added.
- **Latent bug found while testing M1** — datetime keyset cursors were unreliable on
  SQLite (three incompatible text formats). All feeds (memes, comments, messages,
  friends) switched to **id-only keyset pagination**; pagination tests added.
- **M2** — `CHECK` constraints (`media_type`, `friendship.status`) moved onto the
  models so `create_all` (tests) matches the migration; migration `0002` adds
  `ix_likes_meme`; `alembic/env.py` gets `render_as_batch` on SQLite.
- **M3** — all request-path storage I/O goes through `anyio.to_thread` (`storage/aio.py`).
- **M4** — `Content-Length` ceiling (`MAX_REQUEST_BYTES`) enforced in middleware
  before the body is buffered; avatar endpoints now size-check.
- **M5** — uploads are typed from **magic bytes only** (pure-Python sniffer, never the
  client `Content-Type`); images are decoded to confirm; `/media` responses carry
  `X-Content-Type-Options: nosniff` + a `default-src 'none'; sandbox` CSP.
- **M6** — README/`SECURITY.md` document the single-worker requirement; prod also
  refuses to boot with a placeholder `JWT_SECRET` or `DEBUG=true`.
- **M7** — `list_conversations` is now 4 queries regardless of size; `/friends`
  paginates and batch-loads users; `list_requests` batch-loads.
- **M8** — `PATCH /users/me` returns 422 (not 500) for an explicit null on a required
  field; nullable fields can still be cleared. Tested.
- **M9** — production config validator (strong secret, `DEBUG=false`).
- **M10** — `useObjectUrl` hook revokes blob preview URLs on change/unmount.
- **M11** — `react-router-dom` → 7, `vite` → 6, `vitest` → 3; `npm audit` clean;
  CI runs `npm audit --audit-level=high`.
- **M12** — WS loop catches `HTTPException`/`ValidationError` explicitly and lets real
  bugs propagate (logged) instead of swallowing everything.
- **M13** — CI: `npm ci`, pip/npm caching, `mypy` no longer `continue-on-error`,
  coverage gate at 80%, `npm audit` step.
- **Low** — fresh `_credentials_exc()` per call; `WebSocketException` (no double
  close); dead request-id logging wired up; `SQL_ECHO` split from `DEBUG`; hoisted
  inline imports; orphaned-blob cleanup on signup/upload failure;
  `engagement_service.recompute_counters()` repair function (+ test); typing
  indicator + "load earlier messages" wired in `Chat`; error/disabled states on
  `FriendButton` / `CommentList` / `Friends` / chat send; `_clean_tables` derived
  from metadata; `LICENSE` + `SECURITY.md` added.

**New backend tests:** WS delivery / malformed-frame / auth-reject, feed & search
pagination correctness, avatar upload accept/reject, `PATCH` null guard,
unfriend-keeps-history, counter reconciliation. **New frontend test:**
AuthContext ↔ tokenStore sync.

The remainder of this document is the original finding-by-finding review, kept for
reference.

---

## Original review

The code runs, is internally consistent, and the architecture is sound. The findings
below are about correctness edge cases, security hardening, and the gap between the
current state and production-readiness (PLAN.md phases 12–14 are not started).

**Severity legend:** 🔴 High · 🟠 Medium · 🟡 Low / nit

---

## 🔴 High

### H1. Inconsistent visibility model — any meme is readable/likeable/commentable by ID
`GET /memes/{id}` ([feed_service.get_meme](backend/app/services/feed_service.py#L73)),
`PUT /memes/{id}/like`, `POST /memes/{id}/comments`
([engagement_service](backend/app/services/engagement_service.py)) perform **no
friendship or ownership check** on the meme. The feed, however, is friends-only
([feed_service.get_feed](backend/app/services/feed_service.py#L55)). So a user cannot
*discover* a stranger's meme through the app, but can fully interact with it by
guessing/enumerating the integer id (`/memes/1`, `/memes/2`, …).

Decide the model and make it consistent:
- If memes are **public** (reasonable for a meme site) — fine, but say so in
  `AGENTS.md`/`PLAN.md`, and note that the feed is just a friends filter.
- If memes are **friends-only** — add a visibility check in `get_meme`, `like`,
  `unlike`, `add_comment`, `list_comments` (author is caller **or** a friend).

Integer, sequentially-assigned ids make enumeration trivial either way; consider
opaque ids (UUID/hashids) for anything non-public.

### H2. `accept_request` can silently no-op under a conversation-creation race
[friend_service.accept_request](backend/app/services/friend_service.py#L97) sets
`fr.status = "accepted"` and then calls
[`get_or_create_conversation`](backend/app/services/friend_service.py#L29), which on a
unique-constraint race does `await db.rollback()` (line 44). That rollback discards
the **entire session transaction**, including the `fr.status` change made moments
earlier. The following `await db.commit()` then commits nothing. Result: the endpoint
returns `200 accepted`, but the friendship stays `pending` and no conversation is
linked to this call.

Fix: don't `rollback()` the shared session inside a helper. Use a `SAVEPOINT`
(`db.begin_nested()`) around the conversation insert, or re-order so the conversation
is fetched/created before mutating the friendship, or catch the `IntegrityError` and
re-`SELECT` without rolling back the outer transaction.

### H3. Unhandled 500s are swallowed with no logging
[main.py:39-41](backend/app/main.py#L39-L41) — the catch-all
`unhandled_exception_handler` returns `{"detail": "Internal server error"}` and
**never logs the exception or traceback**. Any real bug in production is invisible.
Add `logging.getLogger(...).exception("unhandled error", extra={"path": request.url.path})`
before returning. (Also consider not registering a bare `Exception` handler at all in
debug so the framework traceback shows.)

### H4. `LocalStorage` path-traversal guard is bypassable
[storage/local.py:16-20](backend/app/storage/local.py#L16-L20):
```python
if not str(p).startswith(str(self.root.resolve())):
    raise ValueError("path traversal detected")
```
A prefix check on the string form passes for sibling paths — e.g. root
`/app/media_store`, key resolving to `/app/media_store_x/evil` starts with the root
string and is accepted. Use `p.is_relative_to(self.root.resolve())` (3.9+) or compare
against `str(root) + os.sep`. Exploitability today is low (keys are server-generated
`memes/<id>/<uuid>.<ext>`), but this function *is* the containment control.

### H5. `useChatSocket` leaks a socket on unmount during reconnect backoff
[hooks/useChatSocket.ts:42-48, 64-71](frontend/src/hooks/useChatSocket.ts#L42-L48) —
`onclose` schedules `setTimeout(connect, delay)`. The cleanup sets
`closedRef.current = true` and closes the current socket, but:
- the pending `setTimeout` is never cleared, and
- `connect()` doesn't check `closedRef` before opening a new `WebSocket`.

So unmounting (navigating away from `/chat`) while a reconnect is pending spawns a
zombie socket with no owner and no cleanup. Store the timer id in a ref and
`clearTimeout` it in cleanup; early-return from `connect` when `closedRef.current`.

### H6. `AuthContext` doesn't react to `tokenStore` being cleared
When the axios refresh flow fails it calls `tokenStore.clear()`
([axiosClient.ts:27](frontend/src/api/axiosClient.ts#L27)), but `AuthContext`
([auth/AuthContext.tsx](frontend/src/auth/AuthContext.tsx)) never subscribes to the
store. `tokenStore.subscribe(...)` is implemented
([api/tokenStore.ts:26](frontend/src/api/tokenStore.ts#L26)) but has **no
subscribers**. Consequence: after a session becomes invalid mid-use, `user` stays
set, `isAuthenticated` stays `true`, the user keeps seeing an authenticated shell
whose every request 401s, with no redirect to `/login`. Wire `AuthContext` to
`tokenStore.subscribe` and clear `user` when the access token goes away.

---

## 🟠 Medium

### M1. `search_users` cursor pagination is incorrect
[users.py:82-101](backend/app/api/v1/users.py#L82-L101) orders results by
`User.username ASC` but pages with `WHERE User.id > cursor.id` and then builds the
next cursor from `created_at`. Ordering key ≠ pagination key ⇒ rows are skipped or
repeated across pages. Order by `(username, id)` and filter
`(username, id) > (cursor.username, cursor.id)` (or just order by `id` if username
ordering isn't important).

### M2. Test schema is built from the ORM, not from the migration
[tests/conftest.py:44-45](backend/tests/conftest.py#L44-L45) uses
`Base.metadata.create_all`. But several CHECK constraints exist **only** in the
Alembic migration, not on the models:
- `media_assets.media_type IN ('image','video')` — model has no `__table_args__`
- `friendships.status IN ('pending','accepted','declined','blocked')` — model omits it

So tests run against a schema that's more permissive than production, and a migration
regression would not be caught by `pytest` (CI runs `alembic upgrade head` against a
*different* throwaway DB). Either add the constraints to the models (single source of
truth) or have the test fixture run the migrations.

### M3. Blocking storage I/O on the async event loop
[meme_service.py:73](backend/app/services/meme_service.py#L73),
[users.py:64](backend/app/api/v1/users.py#L64),
[auth.py:57](backend/app/api/v1/auth.py#L57) all call `get_storage().put(...)`
synchronously. `LocalStorage.put` does `path.write_bytes`; `S3Storage.put` does a
blocking `boto3` call. Both stall the whole worker's event loop for the duration.
`storage/base.py` even documents this ("callers should offload with anyio.to_thread")
but no caller does. Wrap storage calls in `anyio.to_thread.run_sync(...)` (or use
`aioboto3` for S3).

### M4. Upload size is only checked *after* reading the whole body into memory
[meme_service.py:47-66](backend/app/services/meme_service.py#L47-L66) — `await
upload.read()` buffers the entire file, then `len(data) > limit` rejects it. A client
can force the server to allocate arbitrary memory before the check. `PUT
/users/me/profile-picture` ([users.py:58-64](backend/app/api/v1/users.py#L58-L64))
has **no size check at all**. Add a max-request-body guard at the ASGI layer
(`starlette` middleware or reverse-proxy `client_max_body_size`) and stream-with-cap
instead of `read()`.

### M5. Content-type is trusted when `libmagic` isn't present
[meme_service._sniff_mime](backend/app/services/meme_service.py#L19-L25) falls back to
the client-supplied `upload.content_type` when `import magic` fails — which is exactly
the case on machines without `libmagic` (including the current dev box). The avatar
endpoints ([auth.py:53-55](backend/app/api/v1/auth.py#L53-L55),
[users.py:60-62](backend/app/api/v1/users.py#L60-L62)) trust `content_type`
unconditionally. A client can upload an HTML/JS payload as `image/png`. Since media is
served same-origin from `/media` (M11), that's a stored-XSS vector. Make `libmagic` a
hard dependency, or validate images by decoding with Pillow and re-encoding, and serve
media from a separate origin with `Content-Disposition: attachment` / a strict CSP.

### M6. In-process `ConnectionManager` breaks with more than one worker
[realtime/connection_manager.py:43](backend/app/realtime/connection_manager.py#L43) is
a module-global dict. The README's production command runs `gunicorn ... -w 2`. A
WebSocket held by worker A will not receive a message broadcast from a REST
`POST /messages` handled by worker B. Until Redis pub/sub is added (PLAN acknowledges
this), production must run a **single** worker, and that constraint should be written
down next to the deploy command.

### M7. N+1 queries and unbounded list endpoints
- [chat_service.list_conversations](backend/app/services/chat_service.py#L92-L138):
  per conversation, one query for the other user + one for the last message + one
  count. Use `selectinload` / a windowed join / a single aggregate query.
- [friends.list_friends](backend/app/api/v1/friends.py#L84-L108) and
  [friends.list_requests](backend/app/api/v1/friends.py#L28-L62): one `db.get(User)`
  per row, and **no pagination** — PLAN.md §4 says `GET /friends` is paginated.

### M8. `PATCH /users/me` with an explicit null on a required field → 500
[users.py:46-48](backend/app/api/v1/users.py#L46-L48) iterates
`model_dump(exclude_unset=True)` and `setattr`s. `UserUpdate.lives_in` / `.caption`
are `str | None`, so `{"lives_in": null}` is "set" (not excluded), `setattr(user,
"lives_in", None)` passes, and the `NOT NULL` violation surfaces as an uncaught
`IntegrityError` → 500 instead of 422. Drop `| None` for the required fields in
`UserUpdate`, or filter out `None` values explicitly.

### M9. No production guard on secrets / config
[config.py:23](backend/app/core/config.py#L23) — `jwt_secret` defaults to
`"change-me"`. Nothing checks that it differs from the default when
`environment == "production"`. Add a validator that raises on startup if a production
deployment is using placeholder secrets. Also: `env_file=".env"` is CWD-relative, so
running `alembic`/`uvicorn` from another directory silently skips it.

### M10. `URL.createObjectURL` leak
[Signup.tsx:37](frontend/src/pages/Signup.tsx#L37),
[UploadForm.tsx:14](frontend/src/components/UploadForm.tsx#L14) call
`URL.createObjectURL(file)` directly in the render body — a new blob URL every render,
never `URL.revokeObjectURL`. Move to `useMemo` + an effect cleanup that revokes.

### M11. Dependency vulnerabilities
`npm audit`: 6 findings incl. **1 critical / 1 high** in `react-router` /
`react-router-dom@6.24.0` (open-redirect via backslash in `<Link>`, constructor
injection in SSR hydration deserialisation). Not all are reachable here (no SSR), but
the open-redirect one is. Bump `react-router-dom` (v7 is a breaking change — budget
for it) and add `npm audit --audit-level=high` to CI.

### M12. WebSocket message loop swallows everything
[chat.py:142-146](backend/app/api/v1/chat.py#L142-L146) — `except Exception as exc:
... send_json({"type":"error","detail": str(detail)})` catches programming errors the
same as expected `HTTPException`s and keeps the loop running, so genuine bugs are
invisible and the socket looks healthy. Catch `HTTPException` (and `ValidationError`)
explicitly; let anything else propagate to close the socket and be logged. Also
`str(detail)` stringifies a list of validation errors unhelpfully.

### M13. CI gaps
[.github/workflows/ci.yml](.github/workflows/ci.yml):
- `npm install` should be `npm ci` (a `package-lock.json` exists) for reproducible builds.
- `mypy app` has `continue-on-error: true` — type regressions never fail CI even
  though mypy is currently clean. Remove it.
- No coverage measurement/threshold (PLAN.md §13 wants ≥ 80%).
- No pip/npm caching → slow.
- No `npm audit` / `pip-audit` step.

---

## 🟡 Low / Nits

- **Shared exception instance.** [deps.py:20-24](backend/app/core/deps.py#L20-L24) —
  `_CREDENTIALS_EXC` is one module-level `HTTPException`; `raise _CREDENTIALS_EXC from
  exc` mutates its `__cause__`/`__traceback__`, shared across concurrent requests.
  Build it fresh per call (or a small factory).
- **Possible double-close on WS auth failure.**
  [deps.py:55-62](backend/app/core/deps.py#L55-L62) closes the socket, then re-raises
  `HTTPException`, which Starlette also handles — can emit "websocket.close after
  close".
- **WS token in query string.**
  [deps.py:53](backend/app/core/deps.py#L53) — `?token=<jwt>` lands in proxy/access
  logs. Prefer the `Sec-WebSocket-Protocol` header or a short-lived ticket.
- **Request-id is cosmetic.** [main.py:32-37](backend/app/main.py#L32-L37) sets a
  response header but never binds the id to a logging `contextvar`, so
  `JsonFormatter`'s `request_id` branch ([logging.py:18](backend/app/core/logging.py#L18))
  is dead code.
- **`configure_logging` at import** clears root handlers
  ([main.py:20](backend/app/main.py#L20)) and can fight uvicorn/gunicorn's own log
  config depending on start order.
- **`DEBUG=true` in `.env.example`** ⇒ SQLAlchemy `echo` logs every statement with
  parameter values (PII in logs). Default the example to `false`.
- **Inline imports.** `from app.core.deps import encode_cursor` inside function bodies
  ([users.py:99](backend/app/api/v1/users.py#L99),
  [engagement_service.py:70](backend/app/services/engagement_service.py#L70)) — no
  cycle exists; hoist them.
- **Orphaned blobs.** Avatar is uploaded before `auth_service.signup` validates
  uniqueness ([auth.py:57](backend/app/api/v1/auth.py#L57)); a meme's `MediaAsset`
  blob is written before the `Meme` row ([meme_service.py:73-95](backend/app/services/meme_service.py#L73-L95)).
  Any later failure leaves a file in storage with nothing referencing it. No GC job.
- **Counter reconciliation.** PLAN.md §3 promises a nightly job to recompute
  `like_count` / `comment_count`; not implemented. Drift is unlikely (same-txn
  updates) but there's no repair path.
- **Dead typing feature.** `useChatSocket` exposes `sendTyping` and accepts `onTyping`
  ([useChatSocket.ts:95](frontend/src/hooks/useChatSocket.ts#L95)) but `Chat.tsx`
  never calls or handles them.
- **Inconsistent mutation UX.** Only `UploadForm` and `MemeCard` handle `onError`.
  `FriendButton`, `CommentList`, `EditProfile`, and `Chat` send have no error surface
  and no pending/disabled state → silent failures and double-submits (e.g.
  double-clicking "Add friend" → 409 shown nowhere).
- **Chat history has no "load older".** [Chat.tsx:36](frontend/src/pages/Chat.tsx#L36)
  loads only the first page; `next_cursor` is ignored in the UI.
- **`likes` has no standalone `meme_id` index** (only the composite PK
  `(user_id, meme_id)`), so a future "who liked this meme" query is a full scan.
- **`alembic/env.py` lacks `render_as_batch=True`** — the next SQLite migration that
  does `ALTER TABLE` will fail.
- **`friend.since` semantics.** [friends.py:106](backend/app/api/v1/friends.py#L106)
  uses `fr.updated_at`, which moves on any row update, not just acceptance.
- **`_clean_tables` hardcodes the table list**
  ([conftest.py:28-38](backend/tests/conftest.py#L28-L38)) — add a table, forget the
  list, get cross-test bleed.
- **React Router v7 future-flag warnings** in test output — harmless now, will bite at
  the v7 bump.
- No `SECURITY.md`, no `LICENSE`, `code_review.md`/`PLAN.md` are the only docs; repo
  is not yet a git repository.

---

## Security summary

| Area | State |
|---|---|
| Password hashing | ✅ `bcrypt` direct, 72-byte truncation handled |
| JWT | ✅ HS256, 15-min access, rotating refresh, hashed + revocable in DB |
| Refresh token storage (frontend) | ⚠️ `localStorage` — XSS-readable, 30-day lifetime. Acceptable per PLAN but an httpOnly cookie is the stronger default. |
| AuthZ per route | ⚠️ present on writes; **missing meme-visibility checks** (H1); IDOR-friendly integer ids |
| File upload validation | ⚠️ MIME sniffing degrades to client-trust without libmagic (M5); no size cap before buffering (M4); SVG correctly excluded |
| Path traversal (local storage) | ⚠️ guard is a bypassable prefix check (H4) |
| Media serving | ⚠️ same-origin `/media` static mount; combined with M5 = stored-XSS path. Serve from isolated origin + `Content-Disposition`. |
| CORS | ✅ explicit allow-list from env; `allow_credentials=True` with a concrete list (not `*`) |
| Rate limiting | ❌ none (PLAN Phase 12) — login, signup, upload, comment, WS messages all unthrottled |
| Security headers / TrustedHost | ❌ none |
| Secrets | ⚠️ placeholder `jwt_secret` default, no production guard (M9) |
| Dependency CVEs | ⚠️ react-router critical/high (M11) |
| SQL injection | ✅ SQLAlchemy Core/ORM throughout, no string-built SQL except the safe dialect-checked functional index |
| XSS (frontend) | ✅ no `dangerouslySetInnerHTML`, no `innerHTML`, React escaping intact |

---

## Test coverage gaps

Current: 22 backend + 7 frontend tests, happy paths plus key negatives (auth
validation, non-friend chat, like idempotency, comment permissions, duplicate friend
requests). Missing:

- **WebSocket handler `/ws/chat` — zero coverage.** No test for live message
  delivery, malformed-frame handling, `read`/`typing` frames, or non-friend rejection
  over the socket. PLAN.md §6 explicitly lists these.
- **Cursor pagination correctness** — no test walks `next_cursor` across ≥ 2 pages of
  feed / comments / messages asserting no duplicates and no gaps.
- **Media validation limits** — no test for oversized upload (413) or the image-vs-
  video branch / dimension probing.
- **Profile** — no test for `PATCH /users/me`, avatar upload, or the null-field 500
  (M8).
- **Search** — `GET /users?search=` untested (would have caught M1).
- **Session lifecycle** — refresh-token reuse after `logout`, expired refresh,
  `friendship_status` transitions, unfriend-keeps-conversation-history.
- Tests bypass Alembic (M2).
- Frontend: no test for the axios 401→refresh→retry interceptor, `AuthContext`, or
  `useChatSocket`.

---

## Deviations from PLAN.md

| PLAN says | Actual |
|---|---|
| `users.email` = `CITEXT` | `String(320)` + app-level lowercasing (portability; documented) |
| `POST /auth/refresh` → `{access_token}` | returns a full rotated `TokenPair` |
| `GET /friends` paginated | returns all rows, unpaginated (M7) |
| Counter reconciliation job | not implemented |
| Phase 12 — rate limiting, security headers, body-size cap, `selectinload` N+1 pass | not started |
| Phase 13 — ≥ 80% coverage, contract test per endpoint, CI coverage gate | partial |
| Phase 14 — Dockerfile/entrypoint, Sentry, `/health` + `/health/db` probes | `/health` + `/health/db` exist; rest not started (Docker intentionally dropped) |

---

## What's good

- **Clean layering** — `api/ → services/ → models/`, schemas isolated, storage and
  realtime behind interfaces. Easy to navigate and to swap implementations.
- **Concurrency correctness by construction** — likes, friend requests, and
  conversation creation rely on DB unique constraints + `IntegrityError` handling, not
  just app-level "check then insert".
- **Keyset pagination** for feed / comments / messages is implemented correctly
  (tuple comparison on `(created_at, id)`), only user-search got it wrong.
- **Auth** — rotating refresh tokens with a hashed, revocable server-side record;
  `logout` revokes; access tokens are short-lived.
- **Friends-only chat** enforced on **both** the REST and WebSocket paths, with tests.
- **Cross-database portability** handled deliberately: `BigIntId` variant for SQLite
  autoincrement, naive-UTC timestamps everywhere, per-dialect functional index in the
  migration.
- **Frontend discipline** — `strict` TS with `noUnusedLocals`/`noUnusedParameters`, no
  `any`, no `ts-ignore`, no XSS sinks; optimistic like with rollback; single axios
  client with refresh-on-401.
- Tooling is green: `ruff`, `mypy`, `tsc`, and both test suites pass.

---

## Suggested priority order

1. **H3** (log 500s) and **M13** (drop `mypy` continue-on-error, `npm ci`) — cheap, high leverage.
2. **H1** — decide and enforce the meme-visibility model.
3. **H2** — fix the `accept_request` rollback race (use `begin_nested`).
4. **H6 / H5** — synchronise `AuthContext` with `tokenStore`; fix the WS reconnect leak.
5. **M4 / M5 / H4** — upload hardening: body-size cap, real MIME validation, fix the path guard, isolate `/media`.
6. **M1 / M8** — fix user-search pagination and the PATCH-null 500.
7. **M2** — make tests run the migration (or move constraints onto the models).
8. **M11** — dependency bump + `npm audit` in CI.
9. **M3 / M7** — offload blocking storage I/O; kill the N+1s; paginate `/friends`.
10. PLAN Phase 12 proper (rate limiting, security headers) before any public deploy;
    single-worker note for **M6** until Redis pub/sub lands.
