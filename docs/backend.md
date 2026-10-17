# Backend implementation notes

## Ownership and tenant isolation

Every schedule, scheduled email, outbox event, and Slack connection carries a
`tenantId`. Google sign-in creates a tenant and owner membership for a new
account, while existing accounts use their first membership as the session
tenant. All API reads and writes take the tenant from the authenticated
session; the optional `ALLOW_DEV_AUTH` header bridge is intended only for
local smoke tests and still requires matching database rows.

Password registration and login create/restore the same session shape as
Google OAuth. `GET /api/auth/me` is the session restore boundary and logout
destroys the Redis-backed session and clears its cookie.

## Delivery flow

`POST /api/schedules` parses the multipart CSV/text payload, validates unique
recipients, and creates the schedule, rich email rows, attachment bytes, and
outbox rows in one Prisma transaction. The outbox
publisher publishes deterministic jobs to BullMQ and marks each event only
after the queue accepts it. Unpublished events are retried after a process
restart, and published pending records are repaired if Redis loses their job.
The worker checks the schedule time, obtains an atomic Redis sender slot,
claims an email with a guarded status transition, sends through
Nodemailer/Ethereal, and records the result. Sender slots use a rolling
one-hour counter plus a minimum inter-send timestamp, and are shared by every
worker instance. A campaign's hourly limit is capped by the global
`SENDER_HOURLY_LIMIT` safety value. Elasticsearch receives the scheduled
document on ingestion and the final delivery update after `SENT`; PostgreSQL
fallback reads keep the dashboard usable during a search outage. Email
list/search reads exclude archived and soft-deleted rows by default, and email
detail/action queries remain tenant-scoped.

The SMTP boundary cannot provide a distributed transaction. Under a crash
between remote acceptance and the database update, the worker uses
`NEEDS_REVIEW` and suppresses automatic replay to preserve at-most-once
behavior; see `apps/api/README.md` for the trade-off.

## Configuration

Copy `apps/api/.env.example` to `apps/api/.env`. Credentials are blank-safe:
Google and Slack routes return a clear 503 until configured, and blank Ethereal
credentials cause Nodemailer to create a temporary test account when the first
message is sent. `WORKER_CONCURRENCY`, `SENDER_MIN_DELAY_MS`, and
`SENDER_HOURLY_LIMIT` control worker throughput and Redis throttling.
