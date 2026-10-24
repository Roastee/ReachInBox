# ReachInbox

> A calm, persistent email scheduling workspace with real delivery controls.

ReachInbox is a TypeScript monorepo for scheduling outbound email campaigns,
controlling sender pacing, and inspecting delivery state from a focused React
mail workspace. It is designed for a realistic local/demo deployment rather
than a simulated UI-only experience.

## Live demo

Open the deployed application here:

**[https://web-ashy-pi-63.vercel.app/login](https://web-ashy-pi-63.vercel.app/login)**

ReachInbox is useful when a team needs a calmer, more controlled way to send
outreach: recipients can be imported, messages can be paced, attachments can be
stored with the campaign, and delivery state can be reviewed from one mailbox
workspace. The backend uses durable database state, Redis-backed queues, and
idempotent schedule creation so retrying the same request does not create a
second copy of the same email queue.

### How to try it

1. Open the live demo and choose **Continue with Google** or create an
   email/password account.
2. Open **Compose** and choose a sender identity.
3. Add recipient chips or upload a CSV/TXT recipient list.
4. Write the subject and rich HTML message, then optionally add attachments.
5. Set the delay/hourly limit and choose **Send Later**.
6. Use the **Scheduled** and **Sent** views to inspect status, open message
   details, and follow the Ethereal preview link for demo delivery.

The demo uses Ethereal SMTP, so it proves the delivery workflow without sending
email to real recipients. Google OAuth requires a configured test account when
the OAuth consent screen is in testing mode.

### Screenshots and walkthrough

The repository includes sanitized screenshots of the live login experience and
the production deployment:

![ReachInbox live login screen](docs/screenshots/reachinbox-login.png)

![ReachInbox production deployment](docs/screenshots/production-deployment.png)

Watch the short visual walkthrough in the repository:

![ReachInbox walkthrough](docs/demo/reachinbox-walkthrough.gif)

- [Download the MP4 walkthrough](docs/demo/reachinbox-walkthrough.mp4)
- [View the walkthrough source script](docs/demo/build_demo_video.py)

## Highlights

- Authenticated email/password sessions with optional Google OAuth.
- CSV/TXT recipient ingestion with validation and duplicate handling.
- Rich email composition with HTML bodies, pacing controls, and attachments.
- Persistent PostgreSQL state through Prisma migrations.
- Redis-backed BullMQ delayed delivery and distributed sender throttling.
- Ethereal SMTP delivery with preview URLs for demo verification.
- Elasticsearch indexing/search with PostgreSQL fallback when search is down.
- Tenant-scoped email detail actions: star, archive, and delete.
- Slack OAuth and live rate-limit notifications when configured.
- Protected Bull Board queue visibility at `/admin/queues`.

## Repository layout

```text
apps/
  api/                 Express API, workers, services, and API tests
  web/                 React/Vite frontend
packages/
  shared/              Shared TypeScript contracts
prisma/
  schema.prisma        Relational data model
  migrations/          Database migrations
infra/
  docker-compose.yml   Local PostgreSQL, Redis, and Elasticsearch
Dockerfile             Railway production API/worker image
railway.json           Railway deployment configuration
apps/web/vercel.json   Vercel SPA routing configuration
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop for the local PostgreSQL, Redis, and Elasticsearch services

The root workspace uses npm workspaces. Install dependencies from the
repository root, not from an individual app directory.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
npm run infra:up
```

This starts:

| Service | Local address | Purpose |
| --- | --- | --- |
| PostgreSQL | `localhost:5432` | Durable relational state |
| Redis | `localhost:6379` | Sessions, BullMQ, and rate limits |
| Elasticsearch | `localhost:9200` | Primary email indexing/search |

### 3. Create local environment files

PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

macOS/Linux:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

The local defaults point at the Docker services. Keep `.env` files private;
they are ignored by Git.

### 4. Generate Prisma Client and migrate

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Start the backend and frontend

Run these in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Bull Board: `http://localhost:4000/admin/queues`

The API process starts both the Express server and the BullMQ email/
notification workers. The outbox publisher runs in the same persistent
process and continuously repairs unpublished or missing queue jobs.

## Backend development

The backend package is `apps/api`. Its important commands are:

```bash
# Start Express, BullMQ workers, and the outbox publisher with file watching
npm run dev:api

# Compile the API and worker code
npm run build:api

# Run API unit/service tests
npm test
```

The backend exposes:

| Route | Purpose |
| --- | --- |
| `GET /healthz` | Lightweight liveness check |
| `GET /readyz` | PostgreSQL, Redis, and Elasticsearch readiness checks |
| `POST /api/auth/register` | Create an email/password account |
| `POST /api/auth/login` | Start an authenticated session |
| `GET /api/auth/me` | Read the current session user |
| `POST /api/auth/logout` | End the current session |
| `POST /api/schedules` | Create an authenticated multipart schedule |
| `GET /api/emails?status=scheduled\|sent` | Search tenant email state |
| `GET /api/emails/:id` | Read one email and attachment metadata |
| `POST /api/emails/:id/star` | Star or unstar an email |
| `POST /api/emails/:id/archive` | Archive or restore an email |
| `DELETE /api/emails/:id` | Soft-delete an email |
| `GET /admin/queues` | Authenticated Bull Board dashboard |

Every `POST /api/schedules` request must include an `Idempotency-Key` header.
The same key is safe to retry for the same tenant and returns the existing
schedule instead of creating duplicate email rows.

## Frontend development

The frontend package is `apps/web`.

```bash
npm run dev:web
npm run build:web
npm run typecheck:web
```

The frontend reads `VITE_API_URL` from `apps/web/.env`. During local Vite
development, `/api` and `/auth` are proxied to that URL so the app works from
both `localhost` and `127.0.0.1` without CORS hostname surprises.

Important frontend flows:

- Email/password login and registration.
- Optional Google OAuth redirect login.
- Scheduled and Sent mailbox tabs with search, filters, refresh, and paging.
- Email reading pane with star, archive, delete, and Ethereal preview links.
- Compose flow with From selector, recipient chips, CSV/TXT parsing, rich text,
  delay/hourly controls, attachments, and Send Later presets.
- Slack connect/disconnect controls and persistent loading, empty, error, and
  toast states.

## Ethereal Email setup

Ethereal is a fake SMTP provider intended for development and demonstrations.
Messages do not reach real recipients; Nodemailer returns a preview URL that
can be opened from the Sent mailbox.

### Automatic temporary Ethereal account

For the fastest demo, leave these variables empty or unset in `apps/api/.env`:

```env
ETHEREAL_USER=
ETHEREAL_PASS=
```

The worker calls `nodemailer.createTestAccount()` on first use and creates a
temporary account automatically.

### Stable Ethereal account

Create an account at [ethereal.email](https://ethereal.email), then set:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
ETHEREAL_USER=your-ethereal-user
ETHEREAL_PASS=your-ethereal-password
DEFAULT_FROM=ReachInbox <no-reply@example.test>
```

Multiple configured sender identities can be supplied through
`ETHEREAL_SENDERS_JSON`:

```env
ETHEREAL_SENDERS_JSON=[{"from":"sales@example.test","user":"...","pass":"..."}]
```

Do not commit credentials or paste them into source files. Ethereal credentials
belong only in private environment configuration.

## Core environment variables

The complete templates are in `apps/api/.env.example` and
`apps/web/.env.example`. The most important backend values are:

```env
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:5173
SESSION_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox?schema=public
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=reachinbox-emails
```

Production deployments should use a managed PostgreSQL provider such as
Supabase, a managed Redis instance, and private environment variables. The
database password must be URL-encoded when special characters are present.

## Architecture

### Scheduling flow

1. The authenticated frontend submits a multipart request to
   `POST /api/schedules` with a recipient CSV/TXT file, optional attachments,
   message fields, and an `Idempotency-Key`.
2. The API validates recipients, required content, sender addresses, dates,
   pacing values, upload sizes, and duplicate recipients.
3. A single PostgreSQL transaction creates the Schedule, ScheduledEmail rows,
   attachment bytes, and durable outbox events.
4. The outbox publisher adds one delayed BullMQ job per email using the stable
   `email-<email-id>` job ID.
5. The worker claims each email with a conditional database transition, applies
   the distributed sender gate, sends through Ethereal SMTP, and persists the
   final status and preview URL.

### Persistence and restart recovery

- PostgreSQL is the source of truth for schedules, email status, attempts,
  timestamps, attachments, sessions, and outbox events.
- Redis stores BullMQ state and the distributed sender limiter.
- Each scheduled email has a deterministic BullMQ job ID.
- The outbox publisher retries unpublished events and repairs pending database
  emails whose Redis jobs disappeared after a crash.
- Email claims use conditional `PENDING`/`FAILED` → `SENDING` transitions so
  concurrent workers cannot both send the same database row.
- SMTP cannot provide a transaction spanning Ethereal and PostgreSQL. If the
  process dies after SMTP accepts a message but before PostgreSQL records
  `SENT`, the email becomes `NEEDS_REVIEW` rather than being blindly replayed.

### Rate limiting and concurrency

- `WORKER_CONCURRENCY` controls BullMQ worker concurrency; the default is `5`.
- The minimum effective delay is the greater of the global
  `SENDER_MIN_DELAY_MS` and a schedule's `delaySeconds` value.
- A Redis Lua script atomically enforces both the inter-send delay and a rolling
  one-hour sender limit.
- The sender key is tenant- and sender-specific, so multiple workers and
  application instances share the same limits safely.
- When the limit is reached, the job is moved back to a delayed state instead
  of being dropped or permanently failed.
- A deterministic notification job sends one Slack rate-limit message per
  sender/hour bucket when Slack is connected.

### Search and indexing

- Email documents are indexed in Elasticsearch with tenant/status/visibility
  filters.
- `EMAIL_INDEX` outbox events make ingestion and later star/archive/delete
  updates retryable after Elasticsearch outages.
- PostgreSQL search is used as an availability fallback when Elasticsearch is
  unavailable, which keeps the quick demo usable without provisioning a
  managed Elasticsearch cluster.

## Implemented features

### Backend

- **Scheduler:** multipart CSV/TXT scheduling, per-row overrides, rich HTML
  bodies, future dates, attachments, and deterministic delayed BullMQ jobs.
- **Persistence:** PostgreSQL/Prisma schema and migrations for users, tenants,
  memberships, schedules, emails, attachments, Slack connections, and outbox
  events.
- **Restart safety:** transactional outbox, job recovery, deterministic IDs,
  conditional worker claims, and explicit `NEEDS_REVIEW` ambiguity handling.
- **Rate limiting:** Redis-backed rolling hourly limits and minimum sender
  delay, configurable through environment variables.
- **Concurrency:** configurable BullMQ worker concurrency with atomic Redis
  coordination and tenant/sender-scoped limits.
- **Delivery:** Nodemailer/Ethereal SMTP with temporary accounts, stable
  credentials, multiple sender identities, and preview URLs.
- **Search:** Elasticsearch indexing/search, tenant isolation, visibility
  filters, and PostgreSQL fallback.
- **Auth:** email/password registration/login/logout, session cookies, and
  optional Google OAuth.
- **Integrations:** Slack OAuth storage, disconnect/reconnect, and live rate
  limit notifications through webhook or `chat.postMessage`.
- **Operations:** protected Bull Board, liveness/readiness endpoints, upload
  limits, and structured failure states.

### Frontend

- **Login:** email/password login and registration, Google OAuth button, and
  explicit opt-in preview mode.
- **Dashboard:** light ReachInbox mailbox layout with Scheduled and Sent tabs,
  search, filters, refresh, pagination, loading, empty, error, and toast states.
- **Reading pane:** dynamic authenticated-user data, message body/HTML,
  sender/recipient metadata, attachment links, Ethereal preview links, star,
  archive, and delete actions.
- **Compose:** From selector, recipient chips, CSV/TXT upload and validation,
  rich-text toolbar, subject/body, delay, hourly limit, attachments, and Send
  Later presets.
- **Responsive UX:** compact sidebar, mobile navigation, modal compose layout,
  keyboard focus states, and reduced-motion support.
- **Integrations:** Slack connection controls and authenticated session-aware
  account menus.

## Demo deployment

The smallest deployment that preserves real backend behavior is:

```text
Vercel          → apps/web
Railway         → Express API + BullMQ worker + outbox publisher
Railway Redis   → BullMQ, sessions, and distributed rate limiter
Supabase        → PostgreSQL/Prisma database
Ethereal        → fake SMTP delivery and preview URLs
```

Current demo deployment:

| Component | URL |
| --- | --- |
| Frontend | <https://web-ashy-pi-63.vercel.app/login> |
| API readiness | <https://api-production-8f03.up.railway.app/readyz> |
| Google OAuth start | <https://api-production-8f03.up.railway.app/auth/google> |

For Vercel, set the project root to `apps/web` and configure `VITE_API_URL`
and, optionally, `VITE_GOOGLE_AUTH_URL` to the public Railway API URL, for
example `https://api.example.com` and `https://api.example.com/auth/google`.
The frontend also guards against a loopback OAuth URL accidentally leaking from
local `.env` values into a production build. For Railway, deploy the root
`Dockerfile`, set `DATABASE_URL`, `REDIS_URL`, `WEB_ORIGIN`, `WEB_ORIGINS`, and
`SESSION_SECRET`, then let the container run `prisma migrate deploy` before
starting the API and worker. `WEB_ORIGINS` is a comma-separated list for
additional Vercel deployment URLs; production sessions use secure cross-site
cookies for the Vercel-to-Railway setup.

## Assumptions, shortcuts, and trade-offs

- This repository intentionally uses a persistent API/worker process; the
  BullMQ worker and outbox publisher are not suitable for a Vercel-only
  serverless deployment.
- Elasticsearch is the primary search implementation, but the API falls back
  to PostgreSQL for a lower-friction demo deployment.
- Ethereal is intentionally fake SMTP. It proves the delivery path and gives
  preview URLs, but it does not deliver mail to real recipients.
- SMTP exactly-once delivery is impossible across a remote SMTP server and a
  local database transaction. The implementation chooses at-most-once replay
  after ambiguous handoff and surfaces `NEEDS_REVIEW`.
- A schedule is capped at 10,000 unique recipients per request to keep the
  transaction and upload path bounded. Larger campaigns should be chunked.
- Slack and Google OAuth require real provider credentials and callback URLs;
  they remain disabled when credentials are absent.
- Demo mode is explicit opt-in and does not replace authenticated API behavior.
- Attachments are stored as PostgreSQL byte data for simple tenant-scoped
  retrieval. A production-scale deployment may move large files to object
  storage.

## Verification commands

From the repository root:

```bash
npm run typecheck
npm test
npm run build
```

The API test suite covers CSV parsing, password hashing, deterministic job IDs,
tenant-scoped email access, rich body/attachment persistence, and rate-limit
notification identifiers.

## Project reference

Repository destination:

<https://github.com/Roastee/ReachInBox>
