# ACOB CRM3

ACOB CRM3 is a frontend replacement for the upstream Meter System, with a Node/Express backend proxy that keeps credentials and session handling off the browser.

## Supported scope

The shipped product surface is the reduced PDF-parity set documented in `ARCHITECTURE.md`: dashboard, token generation and records, remote operations, report views, management pages for customer/account/tariff/gateway, and the hidden profile page.

Removed areas are intentionally not part of the app right now, including station, role, user management, daily data, GPRS task/online-status pages, firmware update task, and storage manager.

## Setup

1. Copy `.env.example` to `.env` and fill in the real upstream and session values.
2. Start Redis if you are using `SESSION_STORE_MODE=redis`.
3. Run the backend and frontend in separate terminals, or use Docker Compose.

## Commands

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
npm test
npm --prefix backend run build
npm --prefix frontend run build
```

## Docker

```bash
docker compose up --build
```

## Environment

Required values include `UPSTREAM_API_URL`, `UPSTREAM_USERNAME`, `UPSTREAM_PASSWORD`, and `JWT_SECRET`. Optional values cover Redis, metrics, and Supabase integration.

## Notes

The frontend README only covers the UI package; this root README is the main project entry point for setup, scope, and deployment guidance.
