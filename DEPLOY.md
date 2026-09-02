# Deploying MemeShare

Target architecture:

| Piece            | Host                        | Notes                                                        |
|------------------|-----------------------------|-------------------------------------------------------------|
| Backend API + WS | **Render** (web service)    | Single instance, single worker — in-process WebSocket registry |
| Database         | **Render PostgreSQL 16**    | Provisioned by `render.yaml`                                 |
| Media (img/video)| **Cloudflare R2**           | S3-compatible; served from its own origin                    |
| Frontend (SPA)   | **Cloudflare Pages**        | Static Vite build                                            |

All config lives in the repo: [render.yaml](render.yaml), the DB-URL normalization in
[backend/app/core/config.py](backend/app/core/config.py), and the SPA fallback
[frontend/public/_redirects](frontend/public/_redirects). Deploys are git-driven —
you connect the GitHub repo in each dashboard once, then every push to `main` ships.

---

## 0. Push the repo to GitHub

```bash
# create the repo on github.com (private), then:
git remote add origin git@github.com:<you>/memeshare.git
git push -u origin main
```

Nothing sensitive is tracked — `.env`, `*.db`, `media_store/`, `.venv/`, `node_modules/`
are all gitignored. Only `.env.example` files are in the repo.

---

## 1. Cloudflare R2 (do this first — the API needs the credentials)

1. Cloudflare dashboard → **R2** → *Create bucket* → name it `memeshare-media`, location
   automatic. Leave it **private**.
2. **R2 → Manage R2 API Tokens → Create API token**
   - Permissions: *Object Read & Write*
   - Scope: *Apply to specific buckets only* → `memeshare-media`
   - Create, then copy **Access Key ID**, **Secret Access Key**, and the
     **S3 endpoint** `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. **Public access for reads.** Memes must load in the browser, so the bucket needs a
   public base URL:
   - *Recommended:* bucket → **Settings → Custom Domains** → add `media.yourdomain.com`
     (needs the domain on Cloudflare). This is your `S3_PUBLIC_URL`.
   - *Quick trial only:* bucket → **Settings → Public Development URL** → enable. You get
     `https://pub-<hash>.r2.dev`. Rate-limited; do not use for real traffic.
4. **CORS** (bucket → Settings → CORS policy) — only needed if the frontend ever
   `fetch()`es media; `<img>`/`<video>` tags don't require it. If in doubt, add:
   ```json
   [{ "AllowedOrigins": ["https://<your-pages-domain>"],
      "AllowedMethods": ["GET"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
   ```

Keep these four values for step 2: `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
`S3_PUBLIC_URL`.

---

## 2. Render — backend + database

1. **New → Blueprint**, connect the GitHub repo. Render reads `render.yaml` and shows
   a database `memeshare-db` + a web service `memeshare-api`. Apply.
2. First deploy will **fail or crash-loop** until the R2 vars are set — expected.
   Go to **memeshare-api → Environment** and fill the `sync: false` vars:
   - `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL` (from step 1)
   - `CORS_ORIGINS` — leave blank for now; set it in step 4 once you know the Pages URL.
3. Confirm the auto-set vars: `DATABASE_URL` is wired from the DB; `JWT_SECRET` was
   generated — open it and check it is ≥ 32 characters (regenerate if not).
4. **Manual Deploy → Deploy latest commit.** Watch the logs:
   - build: `pip install -e '.[prod]'`
   - pre-deploy: `alembic upgrade head` (creates the schema)
   - start: `gunicorn ... -w 1`
5. Verify:
   - `https://memeshare-api.onrender.com/health` → `{"status":"ok"}`
   - `https://memeshare-api.onrender.com/health/db` → `{"status":"ok"}`
   - `https://memeshare-api.onrender.com/docs` loads
6. Note the service URL — it's `https://<name>.onrender.com`. That's your API origin.

**Do not** raise instance count or add a second worker. Chat delivery is in-process
(`app/realtime/connection_manager.py`); a second instance silently breaks it. See
`SECURITY.md` → "Realtime" for the Redis pub/sub path when you outgrow one box.

---

## 3. Cloudflare Pages — frontend

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
   pick the repo.
2. Build settings:
   - **Framework preset:** Vite
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Node version: pinned by `frontend/.node-version` (20)
3. **Environment variables** (Production):
   - `VITE_API_BASE_URL` = `https://memeshare-api.onrender.com/api/v1`
   - `VITE_WS_URL` = `wss://memeshare-api.onrender.com/ws/chat`  ← `wss`, not `ws`
   > These are baked in at build time. Changing them later needs a redeploy.
4. Save and deploy. You get `https://<project>.pages.dev` (or attach a custom domain).

---

## 4. Close the loop — CORS

1. Back in **Render → memeshare-api → Environment**, set:
   - `CORS_ORIGINS` = `https://<project>.pages.dev` (and your custom domain if added,
     comma-separated, no trailing slash)
2. Save → Render redeploys automatically.

---

## 5. Smoke test in production

- Sign up (with a profile picture) → the upload lands in the R2 bucket, and the meme
  image URL points at `S3_PUBLIC_URL`.
- Post a meme, like, comment.
- Open two browsers, send a friend request, accept, open the chat — messages arrive in
  real time (WebSocket to `wss://…/ws/chat`).
- Redeploy the API and confirm the frontend's socket reconnects on its own.

---

## Still required before real users (not covered by this deploy)

These are called out in `SECURITY.md` and the productionization roadmap — the deploy
works without them, but a public UGC app should not launch without them:

- **Rate limiting** on `/auth/login`, `/auth/signup`, meme upload, and the WS connect.
  `slowapi` is in the `prod` extra but not wired in — do it in the app, or put
  Cloudflare rate rules / WAF in front of the Render service.
- **Abuse handling:** report / block, an admin delete + ban path, and ideally an
  automated NSFW/CSAM scan on upload.
- **Legal:** Terms of Service, Privacy Policy, and account+data deletion (you store
  profile pictures, location, and chat logs).
- **Observability:** Sentry (backend + frontend), an external uptime check on
  `/health`, and an alert on the API instance's memory / open-socket count.
- **Backups:** enable automated backups + PITR on the Render database and test a
  restore once.
