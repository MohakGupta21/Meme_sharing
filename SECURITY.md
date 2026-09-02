# Security

## Reporting a vulnerability

Please open a private security advisory (or email the maintainer) rather than a
public issue. Include a description, affected version/commit, and a minimal
reproduction. We aim to acknowledge within 3 business days.

## Notes for operators

- **Secrets:** `JWT_SECRET` must be a strong, unique value in production. The app
  refuses to start in `ENVIRONMENT=production` if it is a placeholder or shorter
  than 32 characters, or if `DEBUG` is true.
- **Tokens:** access tokens are short-lived (15 min); refresh tokens are hashed and
  revocable server-side and rotate on every use. `POST /auth/logout` revokes the
  presented refresh token.
- **Uploads:** media type is determined from magic bytes, never the client-supplied
  `Content-Type`; SVG is rejected. Images are additionally decoded to confirm they
  are real images. A `Content-Length` ceiling (`MAX_REQUEST_BYTES`) is enforced
  before the body is buffered.
- **Media serving:** for the bundled `LocalStorage` backend, `/media` responses carry
  `X-Content-Type-Options: nosniff` and a `default-src 'none'; sandbox` CSP. In
  production serve user media from an origin/bucket separate from the API.
- **Realtime:** the WebSocket `ConnectionManager` is in-process; run a single worker
  until a shared pub/sub backend is configured.
- **Rate limiting / WAF:** not provided by the app — put login, signup, upload and
  the WS endpoint behind a reverse-proxy or API-gateway rate limiter before exposing
  the service publicly.

## Known accepted risks

- The frontend stores the refresh token in `localStorage` (XSS-readable). This is a
  deliberate trade-off for a token-based SPA with no cookie/session backend; mitigate
  with a strict CSP and dependency hygiene, or move the refresh token to an httpOnly
  cookie if a session backend is added.
- Meme ids are sequential integers and memes are publicly readable by id (the feed is
  a discovery filter, not an access boundary — see `feed_service`).
