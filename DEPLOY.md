# Deploying MemeShare — simple free path (Render only)

Everything runs on Render's free tier from one Blueprint file ([render.yaml](render.yaml)):

| Service         | What it is              |
|-----------------|-------------------------|
| `memeshare-db`  | PostgreSQL 16 (free)    |
| `memeshare-api` | FastAPI backend + WS    |
| `memeshare-web` | React frontend (static) |

### Free-tier caveats (read once)

- **Uploaded media is not saved.** Free services have no disk, so profile pics and
  memes vanish on every redeploy/restart. Good enough to try the app; move to
  object storage (S3 / Cloudflare R2) before real users.
- **The API sleeps after ~15 min idle.** Next request takes ~1 min and drops live
  chats. Normal for free.
- **The free database is deleted after 30 days.** Render emails a warning.

---

## Step 1 — Push to GitHub

```bash
git remote add origin https://github.com/<you>/memeshare.git
git push -u origin main
```

(Repo is clean — no secrets tracked.)

## Step 2 — Create the Blueprint on Render

1. Go to <https://dashboard.render.com> → **New → Blueprint**.
2. Connect your GitHub and pick the `memeshare` repo.
3. Render reads `render.yaml` and lists one database + two services. Click
   **Apply**.
4. The first build starts. `memeshare-api` will finish but stay unhealthy until
   Step 3 (CORS not set yet) — that's expected.

## Step 3 — Fill in the 3 blank env vars

In the Render dashboard:

1. Open **memeshare-api** and copy its URL from the top of the page, e.g.
   `https://memeshare-api.onrender.com`.
2. **memeshare-web → Environment** → add:
   - `VITE_API_BASE_URL` = `https://memeshare-api.onrender.com/api/v1`
   - `VITE_WS_URL` = `wss://memeshare-api.onrender.com/ws/chat`  *(wss, not ws)*
3. Open **memeshare-web** and copy *its* URL, e.g.
   `https://memeshare-web.onrender.com`.
4. **memeshare-api → Environment** → set:
   - `CORS_ORIGINS` = `https://memeshare-web.onrender.com`
5. Also on **memeshare-api → Environment**, open `JWT_SECRET` and confirm it is at
   least 32 characters. If shorter, click regenerate.

Each save triggers an automatic redeploy.

## Step 4 — Redeploy the frontend

The frontend baked in the API URL at build time, so after Step 3 do
**memeshare-web → Manual Deploy → Deploy latest commit** once.

## Step 5 — Check it works

- `https://memeshare-api.onrender.com/health` → `{"status":"ok"}`
- `https://memeshare-api.onrender.com/health/db` → `{"status":"ok"}`
- Open `https://memeshare-web.onrender.com`, sign up, post a meme, and open a chat
  in two browsers to confirm realtime messages.

---

## From here to "real users"

Not covered by this free deploy (see `SECURITY.md`):

- Object storage for media (so uploads persist)
- Rate limiting on login / signup / upload / WebSocket
- Report + block, admin delete/ban, NSFW scanning
- Terms of Service, Privacy Policy, account deletion
- Error tracking (Sentry) + uptime monitoring + database backups
- A paid instance so the service doesn't sleep and drop WebSocket connections
