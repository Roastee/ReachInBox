# ReachInbox web

Frontend for the ReachInbox email scheduler assignment. It uses React, Vite, TypeScript, Tailwind CSS, and React Router.

## Run

From `apps/web`:

```bash
npm install
npm run dev
```

The app reads `VITE_API_URL` for the backend origin. Requests use `credentials: "include"` so the authenticated session cookie is sent. The typed API client expects these routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/emails?status=scheduled`
- `GET /api/emails?status=sent`
- `GET /api/emails/:id`
- `POST /api/emails/:id/star`
- `POST /api/emails/:id/archive`
- `DELETE /api/emails/:id`
- `POST /api/schedules` (multipart form upload)
- `GET /auth/slack/connect` (browser OAuth redirect)
- `GET /auth/slack/status`
- `POST /auth/logout`
- `GET /auth/google` (browser redirect)

Copy `.env.example` to `.env.local` and adjust the URL for the API. `VITE_DEMO_MODE=true` only exposes an explicit preview button on the login screen; it is disabled by default. The normal login path supports email/password and Google OAuth.

## Routes

- `/login` — email/password registration and sign-in with Google OAuth alongside it.
- `/dashboard` — light scheduled/sent email workspace, search/filter/pagination, reading pane actions, Slack connection affordance, and compose flow.

Recipient CSV/TXT files are read in the browser. The compose flow shows total, valid, invalid, duplicate, and sample-row counts, supports recipient chips and attachments, and submits `bodyHtml`, pacing controls, and multipart files to the API.
