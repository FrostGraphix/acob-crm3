# AMR API Gap Analysis

Compared sources:
- Live upstream Swagger: http://8.208.16.168:9310/index.html
- Derived reference: [AMR_API_REFERENCE.md](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/docs/AMR_API_REFERENCE.md)
- Project backend and frontend source in this repository

Date of analysis:
- `2026-04-22`

## Executive Summary

The project already covers a large part of the AMR API surface, but it is not a pure 1:1 implementation.

What is in good shape:
- The backend exposes `119` upstream path matches.
- The frontend references `151` API endpoints, and only `2` of those do not have a matching backend route.
- Core AMR business domains are present: `Account`, `Customer`, `Debt`, `DLMS`, `DLT645`, `DLT645Task`, `Gateway`, `GPRSMeterTask`, `Item`, `LoadProfile`, `Meter`, `PrepayReport`, `RemoteMeterTask`, `Tariff`, `Token`, and part of `User`.

Main gaps:
- `25` Swagger-documented upstream endpoints are not exposed by the backend at all.
- Several local routes intentionally diverge from Swagger, but a few of those drifts are risky enough to treat as defects rather than convenience wrappers.
- Import handlers are wired to upstream `create` endpoints instead of upstream `import` endpoints.
- A few frontend route strings do not match the backend exactly.

## Scope And Method

This review compares four layers:

1. The live upstream AMR Swagger specification.
2. Backend route exposure in `backend/src/api` and router mounting in [app.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/app.ts).
3. Backend proxy and alias behavior in [proxy.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/proxy.ts), [rest-aliases.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/rest-aliases.ts), and [endpoint-registry.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/services/endpoint-registry.ts).
4. Frontend endpoint references in `frontend/src`.

Summary counts from the comparison:
- Upstream Swagger paths: `144`
- Unique backend routes discovered: `268`
- Backend routes that match an upstream Swagger path: `119`
- Backend local-only routes: `149`
- Swagger paths missing from backend: `25`
- Frontend endpoint references: `151`
- Frontend references with no exact backend match: `2`

## Correct Coverage

These modules are broadly aligned with the upstream AMR API and are implemented as direct passthroughs or close wrappers:

- `Account`
- `Customer`
- `DailyDataMeter`
- `Dashboard`
- `Debt`
- `DLMS`
- `DLT645`
- `DLT645Task`
- `EventNotification`
- `File`
- `Gateway`
- `GPRSMeterTask`
- `Item`
- `LoadProfile`
- `Log`
- `Meter`
- `PrepayReport`
- `RemoteMeterTask`
- `Tariff`
- `Token`
- Partial `User`

Representative route mounting is in [app.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/app.ts:120) through [app.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/app.ts:169).

## Missing Upstream Coverage

These Swagger-documented upstream endpoints are not exposed by the backend at all:

### Entire missing or effectively missing modules

- `DailyData`
  - `/api/DailyData/read`
  - `/api/DailyData/readMore`
  - `/api/DailyData/readMonthly`
- `GPRSOnlineStatus`
  - `/API/GPRSOnlineStatus/Read`
  - `/API/GPRSOnlineStatus/View`
  - `/API/GPRSOnlineStatus/Update`
- `Role`
  - `/api/role/read`
  - `/api/role/ReadDataRole`
  - `/api/role/create`
  - `/api/role/delete`
  - `/api/role/update`
  - `/api/role/import`
- `Station`
  - `/api/station/read`
  - `/api/station/create`
  - `/api/station/delete`
  - `/api/station/update`
  - `/api/station/import`
- `UpdateFirmwareTask`
  - `/API/UpdateFirmwareTask/GetUpdateFirmwareTask`
  - `/API/UpdateFirmwareTask/CreateUpdateFirmwareTask`

### Partially missing `User` admin surface

- `/api/user/read`
- `/api/user/create`
- `/api/user/delete`
- `/api/user/update`
- `/api/user/import`
- `/api/user/reset`

Why this matters:
- The backend currently covers login, logout, info, profile updates, and password changes, but not the full upstream user-administration surface.
- The app mount list confirms that there are no routers for `role`, `station`, `gprs online status`, `daily data`, or `update firmware` in the mounted API surface. See [app.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/app.ts:120) to [app.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/app.ts:169).

## High-Confidence Gaps And Mismatches

### 1. Import endpoints are implemented against upstream `create`, not upstream `import`

This is the clearest semantic mismatch in the codebase.

The upstream Swagger defines separate `import` endpoints for multiple domains, but the project wires `/import` routes to `createBulkImportHandler(...)` with the upstream `create` path instead of the upstream `import` path.

Examples:
- [account.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/account.ts:11)
- [customer.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/customer.ts:81)
- [debt.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/debt.ts:11)
- [dlms.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/dlms.ts:12)
- [dlt645.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/dlt645.ts:12)
- [gateway.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/gateway.ts:11)
- [item.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/item.ts:12)
- [meter.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/meter.ts:25)
- [tariff.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/tariff.ts:11)

Root behavior:
- [bulk-import.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/bulk-import.ts:36) accepts a `createPath` and iterates each record through `forwardToUpstream(createPath, record, ...)`.

Impact:
- If upstream `import` and `create` have different validation, deduplication, side effects, or performance characteristics, the local `/import` behavior is not actually the same operation as documented.

Assessment:
- `Wrong`, not just different.

### 2. `/api/item/read` is silently rewritten to `/api/item/readItemList`

The Swagger documents both endpoints as separate operations:
- `/api/item/read`
- `/api/item/readItemList`

The local proxy collapses them:
- [proxy.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/proxy.ts:52)
- [proxy.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/proxy.ts:53)

Behavior:
- Any request to local `/api/item/read` is forwarded to upstream `/api/item/readItemList`.

Impact:
- The local system no longer preserves the distinction between the two upstream operations.
- If upstream `/read` and `/readItemList` are intended for different result shapes or business semantics, the local route is misleading.

Assessment:
- `Likely wrong`.

### 3. Method drift against Swagger on at least three routes

The path exists locally, but the HTTP method does not match the live spec.

Confirmed mismatches:
- `/api/user/info`
  - local: `GET`
  - Swagger: `POST`
  - local code: [auth.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/auth.ts:534)
- `/api/DailyDataMeter/readHourly`
  - local: `POST`
  - Swagger: `GET`
  - local code: [daily-data-meter.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/daily-data-meter.ts:8)
- `/api/token/creditTokenRecord/readMore`
  - local: `POST`
  - Swagger: `GET`
  - local code: [token.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/token.ts:265)

Impact:
- This is acceptable only if the backend is explicitly choosing to normalize methods for the frontend.
- It becomes risky if external clients or internal tooling assume Swagger-accurate method behavior.

Assessment:
- `Different by design or drift`, but should be explicitly documented.

### 4. Alias fallbacks include undocumented or wrong-cased upstream candidates

Examples:
- [rest-aliases.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/rest-aliases.ts:27)
- [rest-aliases.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/rest-aliases.ts:28)
- [rest-aliases.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/rest-aliases.ts:46)
- [rest-aliases.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/rest-aliases.ts:210)
- [rest-aliases.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/rest-aliases.ts:224)
- [rest-aliases.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/rest-aliases.ts:332)

Observed drift:
- `"/GPRSOnlineStatus/Read"` and `"/api/GPRSOnlineStatus/Read"` are used as fallback candidates, while the upstream Swagger documents `"/API/GPRSOnlineStatus/Read"`.
- `"/DailyDataMeter/readHourly"` is used as a fallback candidate alongside `"/api/DailyDataMeter/readHourly"`.

Impact:
- These may be defensive compatibility shims, but they also encode path assumptions not supported by the live Swagger contract.
- If the upstream server stops tolerating these variants, local aliases will fail unpredictably.

Assessment:
- `Risky drift`.

## Frontend To Backend Gaps

Frontend endpoint references are mostly consistent with the backend. Only two exact mismatches were found.

### 1. Settlement report points to a route that does not exist

Frontend:
- [wallet-admin-pages.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/frontend/src/config/wallet-admin-pages.ts:414)
- [wallet-admin-pages.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/frontend/src/config/wallet-admin-pages.ts:427)

Uses:
- `/api/reconciliation/settlement/latest`

Backend exposes:
- [reconciliation.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/reconciliation.ts:300)

Actual route:
- `/api/reconciliation/settlement/:settlementRef`

Assessment:
- `Wrong`

### 2. Manual credit approval action uses a different param token than the backend

Frontend:
- [WalletAdminWorkspace.tsx](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/frontend/src/components/data/WalletAdminWorkspace.tsx:257)

Uses:
- `/api/wallet/approvals/:id/approve`

Backend exposes:
- [wallet.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/wallet.ts:1719)

Actual route:
- `/api/wallet/approvals/:requestId/approve`

Notes:
- If the UI replaces `:id` generically before dispatch, this may still work.
- I did not find a generic placeholder interpolation helper that would make that assumption safe.

Assessment:
- `Likely wrong`

## Project-Native Extensions

A large part of the backend is intentionally outside the upstream AMR Swagger contract. These are not bugs by themselves.

Major local-only areas:
- analytics mix and dashboard overlays
- site consumption reporting
- notifications feed and dismiss actions
- theft signals and theft case workflows
- vendor and wallet operations
- reconciliation workflows
- runtime and engine control endpoints
- document upload/download URL management
- search

Examples:
- customer analytics routes in [customer.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/customer.ts:17)
- dashboard overlays in [dashboard.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/dashboard.ts:15)
- management analytics in [management-analytics.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/management-analytics.ts:93)
- wallet domain routes in [wallet.ts](C:/Users/ACOB/Desktop/VS%20Code/acob-crm3/backend/src/api/wallet.ts:263)

Assessment:
- `Correct as local platform extensions`

## Correct vs Wrong Classification

### Correct

- Most core upstream passthrough modules listed in the coverage section.
- Project-native routes that clearly add platform behavior rather than pretending to mirror upstream.
- Frontend usage of most backend endpoints. Only two unmatched references were found across `151` endpoint strings.

### Wrong

- Local `/import` routes calling upstream `create` instead of upstream `import`.
- Frontend settlement report pointing to `/api/reconciliation/settlement/latest` with no matching backend route.
- Local `/api/item/read` being silently rewritten to upstream `/api/item/readItemList`.

### Risky / Needs Clarification

- Method drift on `/api/user/info`, `/api/DailyDataMeter/readHourly`, and `/api/token/creditTokenRecord/readMore`.
- Alias fallback paths using undocumented or wrong-cased upstream candidates.
- Partial implementation of `User` that may be intentional but leaves the admin CRUD surface uncovered.

## Priority Recommendations

1. Fix import semantics first.
   - Rewire local `/import` routes to the actual upstream `/import` endpoints.

2. Fix the known frontend/backend route mismatches.
   - Replace `/api/reconciliation/settlement/latest` with a real backend route or add the missing backend alias.
   - Replace `/api/wallet/approvals/:id/approve` with the actual backend route contract.

3. Remove or document semantic remaps.
   - Decide whether `/api/item/read` should remain distinct from `/api/item/readItemList`.

4. Decide which upstream modules are intentionally unsupported.
   - `DailyData`
   - `GPRSOnlineStatus`
   - `Role`
   - `Station`
   - `UpdateFirmwareTask`
   - `User` admin CRUD and reset

5. Normalize or document method drift.
   - If local routes intentionally change `POST` to `GET` or vice versa, document that in internal API docs so frontend and external integrators are not forced to infer it from code.

6. Tighten alias fallback candidates.
   - Prefer live Swagger-documented paths first.
   - Keep non-Swagger fallbacks only if there is verified upstream evidence they are required.

## Bottom Line

This project is not far from a strong integration layer, but it is not a complete or perfectly faithful mirror of the live AMR API.

The backend is best described as:
- a solid partial upstream adapter
- plus a substantial local analytics and wallet platform
- with a handful of important contract mismatches that should be corrected

The most important concrete defects are the import-path wiring, the settlement route mismatch, and the `item/read` remap.
