# Headless Form Backend - Architecture v0.1

## Goals

- Accept form submissions from any website with low latency.
- Keep dashboard/admin APIs protected by API key auth.
- Store all submissions durably in PostgreSQL.
- Reduce abuse via layered anti-spam controls.

## Data Model (PostgreSQL)

### `users`
- `id UUID PK`
- `email TEXT UNIQUE NOT NULL`
- `name TEXT`
- `plan TEXT NOT NULL DEFAULT 'free'`
- `created_at TIMESTAMPTZ`

### `api_keys`
- `id UUID PK`
- `user_id UUID FK -> users(id)`
- `key_hash TEXT UNIQUE NOT NULL` (SHA-256 hash of raw key)
- `key_prefix TEXT NOT NULL` (for support/debug display)
- `revoked_at TIMESTAMPTZ`
- `last_used_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ`

### `forms`
- `id UUID PK`
- `user_id UUID FK -> users(id)`
- `name TEXT NOT NULL`
- `notify_email TEXT NOT NULL`
- `is_active BOOLEAN NOT NULL DEFAULT TRUE`
- `schema JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ`

### `submissions`
- `id BIGSERIAL PK`
- `form_id UUID FK -> forms(id)`
- `ip INET`
- `user_agent TEXT`
- `payload JSONB NOT NULL`
- `is_spam BOOLEAN NOT NULL DEFAULT FALSE`
- `spam_reason TEXT`
- `created_at TIMESTAMPTZ`

## API Surface

### Public Endpoint
- `POST /f/:formId`
  - Open CORS (`*`), POST-only.
  - Rate-limited per `IP + formId`.
  - Validates payload and size.
  - Optionally enforces per-form field schema rules.
  - Honeypot + optional reCAPTCHA check.
  - Stores submission regardless; spam is marked.
  - Sends email notification for non-spam submissions.

### Authenticated Dashboard Endpoints
- `POST /api/users/register`
  - Creates user and returns first API key.
- `GET /api/forms`
  - Lists forms for API key owner.
- `POST /api/forms`
  - Creates a form.
- `GET /api/forms/:id/submissions`
  - Lists recent submissions for owned form with `limit`/`offset` pagination.
- `GET /api/keys`
  - Lists API keys for the authenticated user.
- `POST /api/keys`
  - Creates a new API key (rotation/additional key).
- `POST /api/keys/:id/revoke`
  - Revokes a specific API key, except when it is the only active key.
- `GET /health`
  - Liveness endpoint for process-level checks.
- `GET /ready`
  - Readiness endpoint that verifies DB connectivity.

All `/api/*` routes use API key auth and return:
- `401` for missing/invalid API key.
- `402` when account plan is `unpaid`.

## Security Controls

- API keys are never stored raw (hash-only at rest).
- `helmet` hardening headers.
- Public route request size and field-size caps.
- Public route rate limiting.
- Honeypot field (`website`) trap.
- Optional reCAPTCHA verification (`RECAPTCHA_SECRET`).
- Dashboard CORS allowlist (`ALLOWED_DASHBOARD_ORIGINS`).

## Observability

- Every response includes `X-Request-Id` (generated if client does not provide one).
- Errors include `request_id` in JSON responses for traceability.
- Structured JSON logs for completed requests and failures.
- Graceful shutdown on `SIGINT`/`SIGTERM` closes HTTP server and DB pool.

## Deploy Model (Render)

- Node Web Service + Managed Postgres via `render.yaml`.
- Startup runs migrations (`npm run db:migrate`) before server boot.
- Required envs documented in `.env.example`.
- CI pipeline (`.github/workflows/ci.yml`) runs unit + integration tests with Postgres service.
