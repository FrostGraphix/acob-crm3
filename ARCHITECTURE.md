# ACOB CRM3 Architecture

## Overview
ACOB CRM3 is a custom customer relationship management platform that acts as a frontend replacement for the existing "Meter System" platform (`8.208.16.168:9311`). The architecture consists of 3 distinct domains:

1. **Frontend (Vite + React + TypeScript + Vanilla CSS + ECharts)**: A modern, performant React application providing a completely responsive and visually stunning UI.
2. **Backend (Node.js + Express + TypeScript)**: A proxy server that mediates all traffic to the upstream API (`8.208.16.168:9311`). This ensures cookies and credentials are never exposed directly to the browser.
3. **Common (`/common/types/`)**: Shared TypeScript models defining the API request/response structures.

## Directory Structure
```
acob-crm3/
├── ARCHITECTURE.md      # This file
├── common/              # Shared code
│   └── types/           # Shared TypeScript models (AmrResponse, AmrRequest)
├── backend/             # Node.js backend
│   ├── src/
│   │   ├── api/         # Route controllers (grouped by domain)
│   │   ├── middleware/  # Auth, Error handling
│   │   ├── services/    # Upstream communication (Axios)
│   │   └── index.ts     # Express entrypoint
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI (PascalCase)
│   │   ├── pages/       # Route pages (PascalCase)
│   │   ├── services/    # API calling layer
│   │   ├── contexts/    # React Contexts
│   │   ├── hooks/       # Custom React hooks
│   │   ├── types/       # Frontend-specific types
│   │   └── index.css    # Global design system
```

## Conventions & Rules

1. **Code Organization**
   - Place files ONLY in the correct directories as defined above.
   - Maintain strict separation between frontend, backend, and shared code.
   - Use only the technologies defined here (no Tailwind CSS, Vanilla CSS only).

2. **Naming Conventions**
   - React components and files: `PascalCase.tsx`
   - Functions and standard variables: `camelCase`
   - Other files (utils, services): `kebab-case.ts`

3. **Development Standards**
   - **Type Safety**: Every function must be fully typed. NO implicit `any`. Use `AmrResponse<T>` and strict interface definitions.
   - **Security**: Never hardcode secrets. Use `.env` variables for the `UPSTREAM_API_URL` and `UPSTREAM_AUTH_CREDENTIALS`.
   - **Quality**: Ensure error handling, loading states, and structured error responses.

4. **Integration Flow**
   - Frontend calls `http://localhost:3000/api/domain/action` via Axios client.
   - Backend `backend/src/api/domain.ts` handles request, reads session cookie, and forwards it via `backend/src/services/upstream.ts`.
   - Upstream API returns `{ code, reason, result }`, which backend normalizes/forwards to frontend.

## Additional Structure (March 2026 Update)
- `common/types/index.ts` now defines shared contracts (`AmrResponse`, `AmrRequest`, auth/session models).
- `backend/src/` uses the architecture target layout with TypeScript files in:
  - `api/` (`auth.ts`, `proxy.ts`)
  - `middleware/` (`auth.ts`, `error.ts`, `rate-limit.ts`)
  - `services/` (`env.ts`, `upstream.ts`, `mock-data.ts`, `response.ts`)
- `tests/` is now a first-class folder:
  - `tests/backend/` for backend behavior and contract tests
  - `tests/frontend/` for frontend catalog/config behavior tests
- Delivery scaffolding is now present:
  - `.github/workflows/ci.yml` for lint/typecheck/test automation
  - `backend/Dockerfile`
  - `frontend/Dockerfile`
  - `frontend/nginx.conf`
  - `docker-compose.yml`

## Additional Structure (March 2026 Endpoint & Validation Update)
- Backend app composition now uses `backend/src/app.ts` as a factory and `backend/src/index.ts` only for process startup.
- API controllers are domain-grouped and mounted per architecture:
  - `backend/src/api/dashboard.ts`
  - `backend/src/api/account.ts`
  - `backend/src/api/customer.ts`
  - `backend/src/api/tariff.ts`
  - `backend/src/api/gateway.ts`
  - `backend/src/api/meter.ts`
  - `backend/src/api/token.ts`
  - `backend/src/api/remote.ts`
  - `backend/src/api/report.ts`
  - `backend/src/api/daily-data-meter.ts`
- Endpoint policy/validation pipeline added:
  - `backend/src/services/endpoint-registry.ts` for endpoint-by-endpoint operation policy
  - `backend/src/services/request-validation.ts` for request sanitization, mapping, and validation
- Integration tests now cover auth + protected proxy behavior in `tests/backend/auth-proxy.integration.test.mjs`.
