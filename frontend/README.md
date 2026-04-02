# Frontend

This package contains the React UI for ACOB CRM3. It is a routed frontend that talks to the backend proxy and renders the supported CRM, token, report, and profile surfaces.

## Local development

Run the frontend from the repo root or directly from this folder:

```bash
npm --prefix frontend run dev
```

## Checks

```bash
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## Scope

Supported screens currently include dashboard, token generation and records, remote operations, reports, management pages for customer/account/tariff/gateway, and the hidden profile page.

The frontend intentionally does not claim support for removed product areas such as station, role, user management, GPRS task/online-status pages, firmware update task, or storage manager.
