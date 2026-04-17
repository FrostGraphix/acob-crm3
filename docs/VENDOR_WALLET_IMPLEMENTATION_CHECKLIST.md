# Vendor Wallet Implementation Checklist

This checklist tracks implementation against the canonical SOP in [ACOB_Vendor_Wallet_SOP_v2.md](C:\Users\ACOB\Desktop\VS Code\acob-crm3\docs\ACOB_Vendor_Wallet_SOP_v2.md). The earlier critique document remains historical context only.

## Phase 0: Foundation

- [ ] Finalize Supabase wallet migrations for vendor, wallet, ledger, receipt, funding, purchase, reconciliation, settlement, approval, audit, session-log, and exception tables.
- [ ] Split migration ownership into foundation, RLS, functions, and commission seed files per SOP v2.
- [ ] Seed default commission rules with `rate = 0.0000`.
- [ ] Enforce JWT claims for `app_role`, `site_code`, `vendor_id`, and `session_id`.
- [ ] Add Express RBAC helpers for role, vendor, and site-scoped access checks.
- [ ] Complete RLS for vendor, wallet, meter, customer, receipt, funding, purchase, exception, and ledger read paths.
- [ ] Add admin credential creation flow with site assignment and temporary password policy.
- [ ] Add immutable audit coverage for credential creation and wallet-sensitive events.
- [ ] Verify client cannot insert, update, or delete immutable financial tables.
- [ ] Verify vendor users cannot query customers or meters outside assigned site scope.

## Phase 1: Onboarding And Wallet Provisioning

- [x] Add first-login forced password-change flow.
- [x] Expand vendor onboarding profile to include business details, contacts, KYC, bank account, and status workflow.
- [x] Add finance onboarding approval queue.
- [x] Auto-provision wallet, ledger accounts, limits, and commission profile on approval.
- [x] Add vendor portal shell with dashboard skeleton and zero-balance state.
- [x] Verify vendor cannot transact until onboarding reaches `active`.

## Phase 2: Funding

- [x] Add vendor funding initiation UI and API.
- [x] Add funding proof upload with validation and storage policy.
- [x] Add finance funding queue and approval flow.
- [x] Post funding journals and refresh balance snapshot after approval.
- [x] Add duplicate bank reference protection.
- [x] Add vendor/admin funding history and funding status tracking.
- [x] Verify statement, balance, and ledger reconcile after posted funding.

## Phase 3: Purchase And Dual Delivery

- [x] Add site-scoped vendor meter/customer search backed by RLS.
- [x] Keep shared reservation and validation logic in `wallet-purchase.ts`.
- [x] Complete `POST /api/wallet/purchase/remote-send`.
- [x] Complete `POST /api/wallet/purchase/generate-token`.
- [x] Persist upstream references, `delivery_method`, `delivery_destination`, `token_value`, and receipt linkage.
- [x] Add numbered receipt retrieval and printable views.
- [x] Add failed-purchase reservation release and reason-code capture.
- [x] Add vendor purchase flow, history, and receipt archive screens.
- [x] Post zero-value commission accrual entries on every successful purchase.
- [x] Verify idempotency prevents duplicate debit and duplicate receipt issuance.

## Phase 4: Reconciliation And Exceptions

- [x] Add full L1-L5 reconciliation logic and daily report locking.
- [x] Add exception SLA fields, assignment, escalation, and coded resolution.
- [x] Add exception board APIs and UI.
- [x] Add daily reconciliation summaries and settlement report retrieval.
- [x] Add runtime engine scheduling for intraday and end-of-day checks using the existing project runtime pattern.
- [x] Verify stuck reservations and upstream/local mismatches are surfaced automatically.

## Phase 5: Commission And Settlement

- [x] Add commission rule management with vendor override support.
- [x] Add accrual posting to commission payable ledger accounts.
- [x] Add daily settlement batch generation and posting.
- [x] Add finance dashboard KPIs for float, reserve, commission, failures, and exhaustion risk.
- [x] Add vendor commission summary/history surface.
- [x] Verify zero-rate history remains reconcilable when non-zero rates are activated later.

## Phase 6: Supabase-Authoritative Reads

- [x] Replace write-mirror-only wallet reads with Supabase-authoritative reads plus cache hydrate-on-miss.
- [x] Rehydrate wallets, purchase orders, funding requests, receipts, and exception state after process restart.
- [x] Add cache-miss read-through tests and restart/hydration tests.
- [x] Fail closed on wallet routes in production when Supabase schema is not ready.
- [x] Verify in-memory state is no longer required for financial correctness.

## Phase 7: Hardening And Production Readiness

- [x] Add maker-checker approvals for large reversals, manual credits, and credit-limit changes.
- [x] Add wallet freeze/unfreeze workflow distinct from vendor suspension.
- [x] Add auto-suspend and fraud/risk triggers for repeated failed proofs, IP anomalies, and rapid purchases.
- [x] Add vendor session IP/device fingerprint logging.
- [x] Add per-vendor rate limiting for purchase and funding endpoints.
- [x] Add concurrency, retry, and crash-recovery stress tests.
- [x] Add exception escalation alerts and near-exhaustion operational alerts.
- [x] Verify production go-live gates from SOP v2 before rollout beyond pilot site.

## Cross-Cutting Verification

- [x] Keep backend wallet route and service tests current.
- [x] Keep frontend vendor wallet route/service tests current.
- [x] Add integration coverage for funding, purchase success, purchase failure, receipts, reversals, reconciliation, settlement, and restart hydration.
- [x] Run backend typecheck, build, and wallet-focused tests after each structural change.
- [x] Run frontend typecheck, build, and wallet-focused tests after each UI/service change.
- [x] Keep [ARCHITECTURE.md](C:\Users\ACOB\Desktop\VS Code\acob-crm3\ARCHITECTURE.md) aligned with the canonical SOP.
