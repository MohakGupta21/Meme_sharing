# Deploying MemeShare — free path

| Piece                  | Host                          |
|------------------------|-------------------------------|
| `memeshare-db`         | Render — PostgreSQL 16 (free)  |
| `memeshare-api`        | Render — FastAPI backend + WS  |
| frontend (React SPA)   | Vercel                        |

### Free-tier caveats (read once)

- **Uploaded media is not saved.** The free Render service has no disk, so profile
  pics and memes vanish on every redeploy/restart. Good enough to try the app; for
  real users switch media to Cloudinary (see below) or S3/R2. User and chat data
  live in Postgres and persist regardless.
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

## Step 2 — Backend + database on Render

1. <https://dashboard.render.com> → **New → Blueprint** → connect GitHub → pick the
   repo. Render reads [render.yaml](render.yaml) (one database + `memeshare-api`).
   Click **Apply**.
2. Wait until **memeshare-db** shows **Available** (2–5 min). Note: Render allows
   only **one free PostgreSQL per account**.
3. On **memeshare-api → Environment**, confirm `JWT_SECRET` is ≥ 32 chars
   (regenerate if not). Leave `CORS_ORIGINS` blank for now.
4. Copy the API URL from the top of the **memeshare-api** page, e.g.
   `https://memeshare-api.onrender.com`.
5. Check `https://memeshare-api.onrender.com/health` → `{"status":"ok"}` and
   `/health/db` → `{"status":"ok"}`.

## Step 3 — Frontend on Vercel

1. <https://vercel.com/new> → **Import** the same GitHub repo.
2. In the import screen:
   - **Root Directory:** click *Edit* → select `frontend`.
   - **Framework Preset:** Vercel auto-detects **Vite** (leave build =
     `npm run build`, output = `dist`). [frontend/vercel.json](frontend/vercel.json)
     already sets these plus the SPA rewrite.
   - **Node.js Version:** 20.x (pinned by `frontend/.node-version`).
3. Expand **Environment Variables** and add (Production + Preview):
   | Name                 | Value                                                |
   |----------------------|------------------------------------------------------|
   | `VITE_API_BASE_URL`  | `https://memeshare-api.onrender.com/api/v1`           |
   | `VITE_WS_URL`        | `wss://memeshare-api.onrender.com/ws/chat`  (wss!)    |
   *(use the real API URL from Step 2.4)*
4. Click **Deploy**. You get `https://<project>.vercel.app`.

> `VITE_*` vars are inlined at build time. If you change them later, redeploy on
> Vercel (**Deployments → ⋯ → Redeploy**).

## Step 4 — Point CORS at Vercel

**Render → memeshare-api → Environment** → set:

```
CORS_ORIGINS = https://<project>.vercel.app
```

Add any custom domain too, comma-separated, no trailing slash. Save → Render
redeploys.

> Vercel preview deployments get unique URLs that won't match `CORS_ORIGINS`. For
> previews to reach the API, add a wildcard-friendly origin or just test against the
> production URL.

## Step 5 — Smoke test

Open `https://<project>.vercel.app`, sign up, post a meme, then open a chat in two
browsers to confirm realtime messages arrive.

---

### Deploying the frontend from the CLI instead (optional)

```bash
npm i -g vercel
cd frontend
vercel            # first run links the project; answer the prompts
vercel --prod     # promote to production
```

Set the two `VITE_*` env vars with `vercel env add` or in the dashboard before
`vercel --prod`.

---

## Persisting media — Cloudinary

Memes and avatars can be stored in a Cloudinary account so they survive redeploys
(user accounts and chats are already in Postgres and persist on their own).

1. Create a free Cloudinary account. On the dashboard, copy the **API environment
   variable** — it looks like `cloudinary://<api_key>:<api_secret>@<cloud_name>`.
2. **Render → memeshare-api → Environment**: set `CLOUDINARY_URL` to that string and
   `STORAGE_BACKEND=cloudinary`. Save (Render redeploys).
3. Check `https://memeshare-api.onrender.com/health/storage` →
   `{"status":"ok","backend":"cloudinary"}`.

URLs are rebuilt from config at response time, so no data migration is needed —
but files uploaded while on `local` are already gone and need re-uploading.

Locally: `pip install -e '.[prod]'`, then in `backend/.env` set `STORAGE_BACKEND=cloudinary`
and `CLOUDINARY_URL=...` (or the discrete `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY`
/ `CLOUDINARY_API_SECRET`).

## From here to "real users"

Not covered by this free deploy (see `SECURITY.md`):

- Object storage for media (so uploads persist) — or use the Cloudinary path above
- Rate limiting on login / signup / upload / WebSocket
- Report + block, admin delete/ban, NSFW scanning
- Terms of Service, Privacy Policy, account deletion
- Error tracking (Sentry) + uptime monitoring + database backups
- A paid Render instance so the service doesn't sleep and drop WebSocket connections
