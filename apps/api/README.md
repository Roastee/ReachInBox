# ReachInbox backend

The API is an Express/TypeScript service with PostgreSQL/Prisma persistence,
Redis/BullMQ delivery queues, Nodemailer/Ethereal delivery, Elasticsearch
indexing, Google session authentication, Slack OAuth scaffolding, and a
protected Bull Board view.

## Local setup

1. Start the local dependencies from the workspace root:

   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```

2. Build the shared package and install/build the API dependencies. The
   repository intentionally does not include a root package manager file:

   ```bash
   cd packages/shared
   npm install
   npm run build

   cd ../../apps/api
   npm install
   copy .env.example .env       # Windows
   # cp .env.example .env       # macOS/Linux
   npm run prisma:generate
   npm run prisma:migrate
   npm run build
   npm start
   ```

    `DATABASE_URL`, `REDIS_URL`, and `ELASTICSEARCH_URL` default to the values
   in `infra/docker-compose.yml`. Google and Slack OAuth remain disabled until
   real client credentials are supplied. With no Ethereal credentials, the
   first send asks Nodemailer for a temporary Ethereal account; set
    `ETHEREAL_USER` and `ETHEREAL_PASS` for a stable account and preview inbox.
    Multiple sender identities can be supplied through the optional
    `ETHEREAL_SENDERS_JSON` array; CSV `from` values select the matching
    transport and are also isolated by the Redis sender limiter.

3. Useful endpoints:

   - `GET /healthz` — liveness.
   - `GET /readyz` — PostgreSQL and Redis readiness, plus Elasticsearch status.
    - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, and
      `POST /api/auth/logout` — password session lifecycle. `GET /auth/google`
      and its callback use the same session and tenant membership.
      - `POST /api/schedules` — authenticated multipart upload. Include a unique
        `Idempotency-Key` header on every request. Use a `file`
       field containing CSV/TXT, or a `text`/`csv` field containing CSV text.
       Form fields provide default `subject`, `body`, `from`, `scheduledAt`,
       `bodyHtml`, `delaySeconds`, and `hourlyLimit`; a CSV can override `from`,
       `subject`, `body`, `bodyHtml`, and `scheduledAt` per row. Multipart
       `attachments` fields are persisted per email and delivered by the
       Ethereal worker.
     - `GET /api/emails?status=scheduled&search=...` — tenant-filtered
       Elasticsearch search with a PostgreSQL availability fallback. Archived
       and soft-deleted messages are excluded by default; use the explicit
       `archived`/`deleted` visibility filters when needed. `GET
       /api/emails/:emailId` reads a message, while `POST /star`, `POST
       /archive`, and `DELETE` apply tenant-scoped actions.
    - `GET /auth/slack/connect` and `DELETE /api/slack/disconnect` — real Slack
      OAuth connection lifecycle; the connection stores the encrypted token and
      webhook/channel selected by Slack.
   - `GET /admin/queues` — Bull Board, protected by the same session auth.

The API starts the outbox publisher and workers from `src/server.ts`. A
successful schedule transaction writes one `EMAIL_SCHEDULED` outbox row and one
durable `EMAIL_INDEX` outbox row per email. The publisher retries unpublished
rows, repairs published pending emails whose Redis jobs were lost, retries
Elasticsearch indexing after outages, and uses the persisted
`email-<email-id>` job ID, so a crash between queue publish and outbox update
does not create a second logical job. Sender throttling uses an atomic Redis
sorted-set script for both the configured minimum inter-send delay and rolling
hourly limit. The effective minimum is the greater of `SENDER_MIN_DELAY_MS`
and the schedule's `delaySeconds` value; throttled jobs are moved back to
delayed state and optionally notify the configured Slack channel once per
sender/hour bucket.

## SMTP exactly-once ambiguity

The database transition to `SENT` happens after `transporter.sendMail()`
returns. SMTP has no transaction that spans the remote server and our
PostgreSQL update, so a worker crash after the SMTP server accepts a message
but before the `SENT` update leaves the result ambiguous. The worker claim,
deterministic BullMQ IDs, idempotent status transitions, deterministic SMTP
`Message-ID`, and the `NEEDS_REVIEW` state prevent automatic replay of that
ambiguous send. This chooses at-most-once behavior after SMTP handoff; an
operator can inspect the record before deciding whether a manual retry is
safe.

## Checks

From `apps/api` after dependencies are installed:

```bash
npm test
npm run build
```

The tests cover CSV quoting/validation and deterministic queue identifiers.
