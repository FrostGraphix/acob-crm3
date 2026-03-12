# ACOB CRM3 Architecture

## Overview
ACOB CRM3 is a custom customer relationship management platform that acts as a frontend replacement for the existing "Meter System" platform (`8.208.16.168:9310`). The architecture consists of 3 distinct domains:

1. **Frontend (Vite + React + TypeScript + Vanilla CSS + ECharts)**: A modern, performant React application providing a completely responsive and visually stunning UI.
2. **Backend (Node.js + Express + TypeScript)**: A proxy server that mediates all traffic to the upstream API (`8.208.16.168:9310`). This ensures cookies and credentials are never exposed directly to the browser.
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
  - `services/` (`env.ts`, `upstream.ts`, `response.ts`)
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

## Additional Structure (March 2026 Routing, Charting, and Observability Update)
- Frontend navigation now uses React Router v6 (`frontend/src/main.tsx`, `frontend/src/App.tsx`) instead of custom hash routing.
- Dashboard chart components now use Apache ECharts via `echarts-for-react`:
  - `frontend/src/components/charts/BarChart.tsx`
  - `frontend/src/components/charts/LineChart.tsx`
  - `frontend/src/components/charts/PieChart.tsx`
- Backend runtime observability now includes lightweight request metrics:
  - `backend/src/middleware/metrics.ts`
  - `backend/src/services/metrics.ts`
  - `/metrics` endpoint mounted in `backend/src/app.ts` (enabled via `ENABLE_METRICS`)

## Additional Structure (March 2026 Supabase Auth Update)
- Optional Supabase auth is available behind environment flags:
  - `SUPABASE_AUTH_ENABLED`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Supabase integration points are implemented in:
  - `backend/src/services/supabase.ts`
  - `backend/src/middleware/auth.ts` (token validation + refresh fallback)
  - `backend/src/api/auth.ts` (Supabase login/logout while retaining legacy fallback)
- Supabase integration tests are available behind explicit env gating:
  - `tests/backend/supabase.integration.test.mjs`
  - `npm run test:supabase`

## Additional Structure (March 2026 Real Data, Redis Session, and CSRF Update)
- Mock API fallback has been removed; backend now forwards all registered domain traffic directly to upstream.
- Frontend page configuration is constrained to documented upstream paths from `swagger_paths.txt`; undocumented placeholder/export/print actions have been removed from the catalog.
- Management pages now use page-specific CRUD field definitions instead of a shared `name/remark` placeholder form, and edit dialogs prefill from the selected row before posting back to the respective domain endpoint.
- Frontend and backend now intentionally track the reduced PDF-parity product surface.
- Removed product modules are no longer mounted or navigable:
  - station / role / user management
  - daily data
  - GPRS task and online-status pages
  - firmware update task
  - storage manager
- `backend/src/api/user.ts` now retains only authenticated profile-maintenance endpoints (`updateInfo`, `modifyLoginPassword`, `modifyAuthorizationPassword`) while auth remains in `backend/src/api/auth.ts`.
- Frontend PDF-parity behavior for the remaining surfaced modules is now implemented through shared client services:
  - `frontend/src/services/client-table-actions.ts` for CSV export and printable row views
  - `frontend/src/services/report-analytics.ts` for report summary/chart derivation from real loaded rows
  - `frontend/src/pages/DataPage.tsx` now supports client-side export/print/import actions alongside upstream-backed actions
- Account-maintenance is now a first-class but hidden routed surface:
  - `frontend/src/pages/ProfilePage.tsx` provides `Modify Information`, `Login Password`, and `Authorization Password`
  - `/profile` exists in `frontend/src/config/pageCatalog.ts` but stays excluded from sidebar navigation
  - `frontend/src/components/layout/Header.tsx` is the access point into that hidden route
- Backend user-maintenance and notification services are now explicit route groups instead of relying on generic proxy assumptions:
  - `backend/src/api/user.ts` forwards account-maintenance mutations directly and refreshes the local legacy session user when profile data changes
  - `backend/src/api/notification.ts` exposes unread notification fetch/dismiss flows through the standard envelope contract
  - `backend/src/services/analysis-engine.ts` now authenticates and polls upstream through the shared upstream service layer, supporting both cookie and token auth responses plus multiple report row envelope shapes
- Remaining surfaced PDF-parity modules now include:
  - management import/export on account / customer / tariff / gateway
  - tariff / gateway field schemas aligned to the PDF
  - token-record export + print actions
  - token-generate action labels and quota visibility aligned to the PDF
  - report-specific filters and data/chart analytics using the currently loaded real result set
- Auth/session now uses Redis-backed session records (or explicit memory mode for tests/dev):
  - `backend/src/services/session-store.ts`
  - `SESSION_STORE_MODE`, `REDIS_URL`, `REDIS_KEY_PREFIX`
- Login flow in `backend/src/api/auth.ts`:
  - always calls upstream `/api/user/login`
  - captures upstream `set-cookie` values
  - maps upstream profile fields into `AuthUser`
  - stores upstream cookie + CSRF token in session state
- `common/types/index.ts` includes `sessionId` in `AuthSessionToken`.
- CSRF protection is enforced for authenticated POST routes:
  - `backend/src/middleware/csrf.ts`
  - `backend/src/app.ts` route composition (`requireAuth` + `requireCsrf`)
  - frontend request propagation in `frontend/src/services/api.ts` (`x-csrf-token`)
- Dependency-aware health probes now exist for operational readiness:
  - `GET /health` (process liveness)
  - `GET /health/dependencies` (upstream + session store readiness)
- Production startup can enforce hard dependency gates:
  - `STRICT_DEPENDENCY_STARTUP=true` fails process boot when upstream/Redis checks fail.
- CI now includes a dependency-health smoke run via backend test script (`test:health`).
- Dashboard data mapping now prefers real upstream series only:
  - `frontend/src/services/dashboard-mapper.ts`
  - empty charts remain empty when upstream does not provide the corresponding series.
