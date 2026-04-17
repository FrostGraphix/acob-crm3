# Wallet Admin Workspace Implementation Plan

## Objective
Separate wallet administration from the internal CRM shell while preserving shared authentication, upstream token-generation access, and shared meter/customer data through the existing backend.

## Target User Experience
- CRM staff continue to log in through the existing `/login` flow.
- The CRM sidebar exposes a single staff entry point: `Vending Wallet`.
- Clicking `Vending Wallet` moves the user into a dedicated Wallet Admin workspace.
- Wallet Admin pages use the same authenticated session and CSRF context already established in CRM.
- Vendors remain isolated in the vendor workspace and never enter CRM internal pages.

## Scope For This Repo
### Frontend
- Add a dedicated `wallet-admin` workspace classification to page config.
- Add a Wallet Admin landing page under `/wallet-admin/overview`.
- Move wallet-admin operational pages out of the CRM management grouping and into a dedicated wallet-admin page catalog.
- Make sidebar navigation workspace-aware:
  - CRM workspace shows one `Vending Wallet` entry point.
  - Wallet Admin workspace shows only wallet-admin sections/pages.
- Preserve the existing vendor workspace split and auth guards.

### Backend
- Reuse existing authenticated wallet, vendor, and reconciliation endpoints.
- Continue using shared session cookies and CSRF enforcement.
- No additional login endpoint is required for Wallet Admin.

## Information Architecture
### CRM Workspace
- Dashboard
- Existing CRM product sections
- `Vending Wallet` launcher only

### Wallet Admin Workspace
- Overview
- Vendor Onboarding
- Funding Queue
- Wallet KPIs
- Commission Rules
- Settlement Batches
- Reconciliation
- Exception Board
- Settlement Reports

## Routing Plan
- Keep CRM default route: `/dashboard`
- Add Wallet Admin routes under `/wallet-admin/*`
- Initial Wallet Admin entry path: `/wallet-admin/overview`

## Authorization Plan
- Staff/admin/finance roles access wallet-admin pages via existing role checks on page config.
- Vendor users remain redirected to `/vendor/*` only.
- Wallet Admin does not introduce a second auth boundary; it relies on the existing authenticated app shell.

## Rollout Notes
1. Introduce wallet-admin page typing and workspace support.
2. Create wallet-admin page catalog and landing page.
3. Make navigation and tabs workspace-aware.
4. Keep existing backend contracts and reuse current endpoints.
5. Validate with frontend build/typecheck.

## Task Checklist

### Phase 1: Workspace Foundation
- [x] Add `wallet-admin` as a first-class frontend workspace.
- [x] Add a dedicated Wallet Admin landing route at `/wallet-admin/overview`.
- [x] Create a wallet-admin page catalog separate from CRM management pages.
- [x] Keep vendor workspace pages isolated under `/vendor/*`.
- [x] Reuse existing authenticated staff session instead of adding a second login flow.

### Phase 2: Navigation And Shell Separation
- [x] Add a single `Vending Wallet` launcher to the CRM sidebar.
- [x] Switch sidebar navigation to wallet-admin sections after entering the wallet workspace.
- [x] Add wallet-admin-specific header/shell cues so the user knows they left the CRM workspace.
- [x] Preserve a quick return path from Wallet Admin back to CRM.
- [x] Keep vendor users blocked from CRM and wallet-admin staff pages.

### Phase 3: Wallet Admin Surface Migration
- [x] Move vendor onboarding queue into wallet-admin routing.
- [x] Move funding approval queue into wallet-admin routing.
- [x] Move wallet KPI reporting into wallet-admin routing.
- [x] Move commission rule management into wallet-admin routing.
- [x] Move settlement, reconciliation, and exception pages into wallet-admin routing.
- [ ] Replace generic data-table experiences with dedicated wallet-admin page experiences where needed.
- [ ] Add richer wallet-admin dashboard widgets sourced from live wallet backend summaries.

### Phase 4: Backend And Access Control
- [x] Reuse existing wallet, vendor, settlement, and reconciliation backend endpoints.
- [x] Enforce wallet-admin access through the existing role-based page filtering.
- [ ] Add explicit backend route guards for wallet-admin-only business actions where still missing.
- [ ] Verify all wallet-admin write endpoints share the same authorization policy and audit expectations.
- [ ] Add backend tests for wallet-admin authorization boundaries.

### Phase 5: Quality Gates
- [x] Add frontend catalog coverage for wallet-admin routes.
- [x] Add frontend access-behavior coverage for vendor vs staff wallet-admin access.
- [x] Update existing vendor-wallet tests to reflect the new wallet-admin routing model.
- [x] Pass full frontend test suite.
- [x] Pass frontend production build.
- [ ] Add end-to-end navigation coverage for CRM -> Wallet Admin -> CRM return flow.

### Phase 6: Remaining Product Work
- [ ] Build dedicated Wallet Admin onboarding review page with approval/rejection workflow UI.
- [ ] Build dedicated Wallet Admin funding review page with finance decision workflow UI.
- [ ] Add wallet-admin reporting summaries for float health, settlement health, and exception SLA state.
- [ ] Add audit-oriented activity views for wallet-admin operators.
- [ ] Document final SOP and operator handoff once the dedicated admin pages are complete.
