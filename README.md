# Headless Backend Form

A headless backend API for accepting form submissions from any website and managing forms via authenticated API endpoints.

## Features

- Public form endpoint (`POST /f/:formId`) with CORS enabled for any origin.
- Optional per-form submission schema enforcement (field types, required fields, bounds).
- Authenticated dashboard endpoints (`/api/*`) protected by API key.
- API key lifecycle endpoints for listing, creating, and revoking keys.
- PostgreSQL schema for `users`, `forms`, `submissions`, and `api_keys`.
- Spam mitigation: rate limiting, honeypot field, optional reCAPTCHA verification.
- Optional email notifications using Resend API.
- Health and readiness probes (`GET /health`, `GET /ready`).
- Request tracing via `X-Request-Id` response header on all routes.
- OpenAPI spec included at `openapi/openapi.yaml`.
- Render blueprint included at `render.yaml`.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Start local Postgres (optional but recommended for local dev):

```bash
docker compose up -d postgres
```

4. Run migrations:

```bash
npm run db:migrate
```

5. Start server:

```bash
npm run dev
```

## Testing

- Unit tests:

```bash
npm test
```

- Integration tests (requires running Postgres):

```bash
npm run test:integration
```

- GitHub Actions CI runs both unit and integration suites on pushes and PRs (`.github/workflows/ci.yml`).

## Environment variables

- `DATABASE_URL` (required)
- `ALLOWED_DASHBOARD_ORIGINS` (required for dashboard/browser API usage)
- `PUBLIC_RATE_LIMIT_WINDOW_MS`, `PUBLIC_RATE_LIMIT_MAX`, `PUBLIC_BODY_LIMIT`
- `RECAPTCHA_SECRET` (optional)
- `RESEND_API_KEY` and `EMAIL_FROM` (optional)

## Operational endpoints

- `GET /health` for liveness.
- `GET /ready` for readiness (checks database connectivity).
- Errors include `request_id` for easier debugging in logs.
- `GET /api/forms/:id/submissions` supports `limit` and `offset` pagination query params.

## Example flow

1. Register user and get first API key:

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","name":"Owner"}'
```

2. Create form:

```bash
curl -X POST http://localhost:3000/api/forms \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"name":"Contact","notify_email":"owner@example.com"}'
```

3. Submit form publicly:

```bash
curl -X POST http://localhost:3000/f/FORM_ID \
  -H "Content-Type: application/json" \
  -d '{"data":{"name":"Jane","message":"Hello"}}'
```

4. Create a second API key (rotation):

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "X-API-Key: YOUR_API_KEY"
```
