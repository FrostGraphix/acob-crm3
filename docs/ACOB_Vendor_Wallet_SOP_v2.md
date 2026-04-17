# ACOB Lighting Technology Limited
# Vendor Wallet Vending Platform
# Standard Operating Procedure — Global Implementation Standard
# Version 2.0

---

## Document Control

| Field | Value |
|---|---|
| Document Title | Vendor Wallet System — Full Implementation SOP |
| System | ACOB CRM3 |
| Stack | React · Express/TypeScript · Supabase · Africa/Lagos timezone |
| Version | 2.0 |
| Classification | Internal — Confidential |
| Scope | End-to-end implementation: schema, backend, frontend, security, testing, operations |

---

## Table of Contents

1. [Executive Summary and System Purpose](#1-executive-summary-and-system-purpose)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Design Principles](#3-core-design-principles)
4. [Security Framework](#4-security-framework)
5. [Data Model — Complete Schema](#5-data-model--complete-schema)
6. [RBAC and RLS — Complete Specification](#6-rbac-and-rls--complete-specification)
7. [Phase 0 — Foundation](#7-phase-0--foundation)
8. [Phase 1 — Onboarding and Wallet Provisioning](#8-phase-1--onboarding-and-wallet-provisioning)
9. [Phase 2 — Funding](#9-phase-2--funding)
10. [Phase 3 — Purchase and Dual Delivery](#10-phase-3--purchase-and-dual-delivery)
11. [Phase 4 — Reconciliation and Exceptions](#11-phase-4--reconciliation-and-exceptions)
12. [Phase 5 — Commission and Settlement](#12-phase-5--commission-and-settlement)
13. [Phase 6 — Supabase-Authoritative Reads](#13-phase-6--supabase-authoritative-reads)
14. [Phase 7 — Hardening and Production Readiness](#14-phase-7--hardening-and-production-readiness)
15. [API Contract — Complete Reference](#15-api-contract--complete-reference)
16. [Frontend UI — Complete Screen Specifications](#16-frontend-ui--complete-screen-specifications)
17. [Runtime Engines](#17-runtime-engines)
18. [Testing Strategy](#18-testing-strategy)
19. [Go-Live SOP](#19-go-live-sop)
20. [Operational Runbooks](#20-operational-runbooks)
21. [What the Completed System Achieves](#21-what-the-completed-system-achieves)

---

## 1. Executive Summary and System Purpose

### What This System Is

The ACOB Vendor Wallet is a controlled financial float system embedded inside ACOB CRM3. It allows approved vendors and resellers to pre-fund a digital wallet and use that float to purchase prepaid electricity units on behalf of their customers. Units are delivered either by remote send directly to a customer's meter, or by generating a token the customer enters manually.

The wallet behaves like a restricted business bank account. Vendors cannot withdraw cash from it. They can only fund it and spend it on unit purchases. Every naira that enters and leaves the wallet is recorded as an immutable accounting entry.

### What It Is Not

This is not a general-purpose fintech wallet. It does not support peer-to-peer transfers, customer-facing wallets, cash withdrawals on demand, or multi-currency operations in v1. It does not replace the existing upstream token generation platform — it wraps it with financial control, auditability, and vendor management.

### Business Rules (Non-Negotiable)

1. Vendors buy units at list price.
2. Commission is configured per vendor but starts at zero. The engine is wired from day one; only the rate changes.
3. Vendors choose delivery method per transaction: remote send or token generation.
4. Vendors see only customers and meters in their assigned site.
5. Admin creates all login credentials. Vendors cannot self-register.
6. No purchase is possible if the vendor wallet has insufficient available balance.
7. No token or unit delivery happens before the wallet reservation is posted.
8. Every transaction produces a numbered receipt, permanently retrievable.
9. All financial entries are immutable after posting. No silent edits, ever.
10. The system must survive process restarts without losing financial state.

---

## 2. Architecture Overview

### Stack

```
Frontend:      React (existing CRM3 frontend)
Backend:       Express / TypeScript
Database:      Supabase (PostgreSQL) — app-native durable store
Token Engine:  Existing upstream meter/token platform (unchanged)
Scheduler:     Existing runtime engine pattern (priority-engines.ts)
Timezone:      Africa/Lagos (WAT, UTC+1) for all business date logic
```

### Service File Structure

```
backend/src/
  api/
    vendor.ts                     -- vendor CRUD, approval, suspension, credential issuance
    wallet.ts                     -- funding, purchase, reversal, limits, statement, balance
    reconciliation.ts             -- manual triggers, exception list, exception resolution

  services/
    wallet-persistence.ts         -- all Supabase read and write operations
    wallet-domain-store.ts        -- in-memory cache with hydrate-on-miss from Supabase
    wallet-ledger.ts              -- double-entry posting, journal creation, balance snapshot
    wallet-funding.ts             -- funding request lifecycle, proof upload, approval
    wallet-purchase.ts            -- shared reservation/validation/finalisation logic
    wallet-purchase-remote.ts     -- remote-send upstream call + receipt generation
    wallet-purchase-token.ts      -- token-generate upstream call + receipt generation
    wallet-commission.ts          -- commission rule lookup, accrual posting, rate engine
    wallet-reconciliation.ts      -- L1–L5 reconciliation logic
    wallet-settlement.ts          -- daily settlement batch, commission credit posting
    wallet-receipt.ts             -- receipt generation, number sequencing, retrieval
    vendor-wallet-risk.ts         -- limit checks, suspension triggers, risk rating

  engines/
    wallet-reconciliation-engine.ts  -- intraday (every 5–15 min) + EOD scheduled jobs
    wallet-settlement-engine.ts      -- daily commission and settlement batch
    wallet-exception-monitor.ts      -- escalation and notification for unresolved exceptions

supabase/
  migrations/
    001_wallet_foundation.sql        -- core tables, constraints, indexes
    002_wallet_rls.sql               -- all RLS policies
    003_wallet_functions.sql         -- receipt sequencing, balance formula, triggers
    004_wallet_commission_seed.sql   -- default commission rule (rate = 0.00)
```

### Key Architectural Decisions

**Double-entry ledger as the single source of financial truth.** The displayed wallet balance is always derived from posted ledger entries via a cached snapshot. The snapshot is a performance optimisation, not the source of truth. If the snapshot and the sum of ledger entries disagree, the ledger entries win.

**Reservation before upstream call.** The wallet is debited (reserved) before any call is made to the upstream token platform. If the upstream call fails, the reservation is released. If the upstream call succeeds but posting fails, the idempotency key ensures safe retry without double-debit.

**Supabase as authoritative persistence.** The in-memory domain store is a process-lifetime cache with hydrate-on-miss behaviour. On any cache miss, the system reads from Supabase and populates the cache. A process restart returns the system to full operational state by rehydrating from Supabase.

**Upstream token platform is unchanged.** All existing token generation routes, contracts, and integrations remain intact. The wallet layer wraps the upstream calls — it does not replace them.

---

## 3. Core Design Principles

These principles are non-negotiable. Every implementation decision must be evaluated against them.

### P1 — Ledger First
Every money movement creates at least two immutable accounting entries (debit and credit). Balance is always derived, never stored as a mutable field.

### P2 — No Silent Mutation
Ledger entries, posted journals, and approved receipts are write-once. Corrections happen through compensating entries with full audit trails, never through UPDATE on posted rows.

### P3 — Idempotent Commands
Every external-facing financial operation accepts an idempotency key. Retrying the same operation with the same key returns the original result without creating duplicate financial records.

### P4 — Money and Token Delivery Are Linked
A wallet debit without a corresponding token issuance or remote send record is an exception. A token/send record without a wallet debit is an exception. Both trigger the reconciliation engine.

### P5 — Reserve Before Call
Never call the upstream token platform before posting a wallet reservation. Never finalise a wallet debit before storing the upstream response reference.

### P6 — Supabase Survives Restarts
No financial state lives only in memory. Every write to the in-memory store mirrors to Supabase. Every read checks the cache and falls through to Supabase on miss.

### P7 — Fail Closed
If Supabase is unreachable, the wallet service returns a clear error. If the wallet migration has not been applied, the service starts in degraded mode and returns 503 on wallet routes. It does not silently operate against stale in-memory state.

### P8 — Site Scope is Enforced at the Database Layer
Vendors cannot query, purchase, or view data outside their assigned site. This is enforced by RLS policies, not just application-layer filtering. An application bug cannot bypass it.

### P9 — Approval Only Where Risk Justifies It
Normal purchases by a funded vendor are automatic. Manual approval is required only for wallet funding (non-automated channels), large reversals, credit limit changes, and manual ledger adjustments.

### P10 — Reconciliation is a System Feature
Intraday and end-of-day reconciliation jobs run as first-class runtime engines. Finance does not run manual spreadsheet reconciliation. The system produces a locked daily report.

---

## 4. Security Framework

### 4.1 Authentication

- All sessions use Supabase Auth with JWT tokens
- JWT payload includes `app_role`, `site_code`, `vendor_id`, and `session_id` as custom claims
- Vendor sessions expire after 8 hours of inactivity
- Internal staff sessions expire after 12 hours
- All tokens are signed with RS256
- Refresh token rotation is enabled — each use issues a new refresh token and invalidates the old one

### 4.2 Credential Management

- Admin is the only entity that can create user credentials (no self-registration)
- All new vendor accounts are issued a temporary password that expires in 72 hours
- First login forces an immediate password change before any wallet operation is permitted
- Passwords must be minimum 12 characters, with at least one uppercase, one digit, and one symbol
- Passwords are hashed with bcrypt (cost factor 12) via Supabase Auth
- Failed login attempts are rate-limited: 5 attempts in 10 minutes triggers a 15-minute lockout
- Account lockout requires admin to unlock manually after 3 consecutive lockout events

### 4.3 Transport Security

- All API endpoints served over HTTPS only; HTTP redirects to HTTPS
- HSTS header with `max-age=31536000; includeSubDomains`
- API responses include: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- CORS restricted to explicitly whitelisted origins only
- All file uploads (proof documents) validated for MIME type and size before storage

### 4.4 Request Signing and Integrity

- All money-moving POST operations require an `X-Idempotency-Key` header (UUID v4)
- Requests without an idempotency key on financial endpoints return 400
- Idempotency keys are stored per operation type with a 24-hour TTL after first use
- Duplicate key + same operation returns original result with `X-Idempotency-Replayed: true` header

### 4.5 Rate Limiting

- Global rate limit: 100 requests per minute per authenticated session
- Purchase endpoints: 10 requests per minute per vendor wallet
- Funding endpoints: 5 requests per 10 minutes per vendor
- Admin credential creation: 20 per hour per admin user
- Rate limit headers returned on all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 4.6 Audit Logging

Every one of the following events writes an immutable row to `audit_logs`:

- User login (success and failure, with IP and user agent)
- Password change
- Credential creation
- Vendor status change (any transition)
- Wallet provisioning
- Funding request creation, approval, rejection
- Purchase initiation, success, failure
- Reversal request, approval, rejection
- Ledger journal posting
- Commission rule change
- Credit limit change
- Reconciliation run start and completion
- Exception creation, assignment, resolution
- Settlement batch execution
- Admin manual ledger adjustment
- Suspension and reactivation

Audit log fields: `id`, `event_type`, `actor_id`, `actor_role`, `target_type`, `target_id`, `site_code`, `ip_address`, `user_agent`, `session_id`, `payload_snapshot` (sanitised, no secrets), `created_at`.

Audit logs are append-only. No RLS policy permits UPDATE or DELETE on `audit_logs` for any role including `service_role`.

### 4.7 Device and IP Fingerprinting

On every vendor purchase action, record:
- IP address
- User agent string
- A device fingerprint hash (derived from user agent + accept-language + screen resolution sent from frontend)

Store in `vendor_session_log`. The reconciliation engine flags vendors with:
- Purchase attempts from 3+ distinct IP addresses in a single business day
- Purchases from an IP address outside the vendor's historical country pattern
- Rapid sequential purchases (more than 5 in 60 seconds)

Flagged sessions generate a `high` severity exception for ops review.

### 4.8 Maker-Checker Controls

The following operations require two distinct approvers with different roles:

| Operation | First Approver | Second Approver |
|---|---|---|
| Reversal above NGN 50,000 | `finance` | `admin` |
| Manual ledger credit adjustment | `finance` | `super_admin` |
| Credit limit activation | `finance` | `admin` |
| Credit limit increase above 20% | `finance` | `super_admin` |
| Wallet reactivation after fraud flag | `ops_manager` | `admin` |
| Settlement batch override | `finance` | `super_admin` |

Maker-checker records are stored in `approval_requests` with `maker_id`, `checker_id`, `action_type`, `payload`, `status`, `maker_at`, `checker_at`.

### 4.9 Data Protection

- All PII fields (customer name, phone, email, bank account) are stored in dedicated columns and excluded from general query SELECT * patterns in service code
- Bank account numbers are masked in all API responses (show last 4 digits only)
- Token values in receipts are masked in list views (show `****-****-****-XXXX`) and only revealed on the individual receipt detail view
- KYC documents are stored in a private Supabase Storage bucket with signed URL access only (URL expires in 15 minutes)
- No PII is written to application logs

### 4.10 Suspension and Freeze Controls

A vendor wallet can be in one of two restricted states:

**Suspended** — vendor account is administratively suspended. All purchases blocked. Funding requests blocked. Read-only access to existing records permitted. Finance can still process outstanding reversals and settlements.

**Frozen** — wallet is frozen by the risk engine. Purchases and new funding blocked. Existing reservations are preserved but cannot be completed until unfrozen. Requires ops + finance dual approval to unfreeze.

---

## 5. Data Model — Complete Schema

### 5.1 Master Tables

```sql
-- ============================================================
-- vendor_organizations
-- ============================================================
CREATE TABLE vendor_organizations (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code       text         UNIQUE NOT NULL,
  legal_name        text         NOT NULL,
  display_name      text         NOT NULL,
  status            text         NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','pending_review','approved','active','suspended','closed','rejected')),
  site_code         text         NOT NULL,
  kyc_status        text         NOT NULL DEFAULT 'not_started'
                                 CHECK (kyc_status IN ('not_started','submitted','under_review','approved','expired','rejected')),
  risk_rating       text         NOT NULL DEFAULT 'unrated'
                                 CHECK (risk_rating IN ('unrated','low','medium','high','blocked')),
  contact_name      text         NOT NULL,
  contact_phone     text         NOT NULL,
  contact_email     text         NOT NULL,
  address_line1     text,
  address_line2     text,
  city              text,
  state             text,
  registration_no   text,
  tax_id            text,
  onboarded_by      uuid,
  approved_by       uuid,
  approved_at       timestamptz,
  suspended_at      timestamptz,
  suspension_reason text,
  metadata          jsonb        NOT NULL DEFAULT '{}',
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_org_site ON vendor_organizations(site_code);
CREATE INDEX idx_vendor_org_status ON vendor_organizations(status);

-- ============================================================
-- vendor_users
-- ============================================================
CREATE TABLE vendor_users (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid        NOT NULL REFERENCES vendor_organizations(id),
  auth_user_id    uuid        UNIQUE NOT NULL,  -- Supabase auth.users.id
  site_code       text        NOT NULL,
  role            text        NOT NULL DEFAULT 'vendor_user'
                              CHECK (role IN ('vendor_user','vendor_manager')),
  is_primary      boolean     NOT NULL DEFAULT false,
  status          text        NOT NULL DEFAULT 'pending_password_reset'
                              CHECK (status IN ('pending_password_reset','active','suspended','locked')),
  last_login_at   timestamptz,
  created_by      uuid        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vendor_users_vendor ON vendor_users(vendor_id);
CREATE INDEX idx_vendor_users_auth ON vendor_users(auth_user_id);
CREATE INDEX idx_vendor_users_site ON vendor_users(site_code);

-- ============================================================
-- vendor_wallets
-- ============================================================
CREATE TABLE vendor_wallets (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid        UNIQUE NOT NULL REFERENCES vendor_organizations(id),
  wallet_number   text        UNIQUE NOT NULL,
  currency_code   text        NOT NULL DEFAULT 'NGN',
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','active','frozen','suspended','closed')),
  allow_credit    boolean     NOT NULL DEFAULT false,
  freeze_reason   text,
  frozen_at       timestamptz,
  frozen_by       uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- vendor_wallet_limits
-- ============================================================
CREATE TABLE vendor_wallet_limits (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id             uuid         UNIQUE NOT NULL REFERENCES vendor_wallets(id),
  daily_purchase_limit  numeric(14,2) NOT NULL DEFAULT 500000.00,
  per_txn_limit         numeric(14,2) NOT NULL DEFAULT 100000.00,
  min_purchase_amount   numeric(14,2) NOT NULL DEFAULT 100.00,
  max_funding_per_day   numeric(14,2) NOT NULL DEFAULT 2000000.00,
  credit_limit          numeric(14,2) NOT NULL DEFAULT 0.00,
  credit_utilized       numeric(14,2) NOT NULL DEFAULT 0.00,
  credit_status         text         NOT NULL DEFAULT 'disabled'
                                     CHECK (credit_status IN ('disabled','active','frozen','delinquent','expired')),
  updated_by            uuid,
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- vendor_commission_rules
-- ============================================================
CREATE TABLE vendor_commission_rules (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           uuid         NOT NULL REFERENCES vendor_organizations(id),
  site_code           text,        -- null = applies to all sites for this vendor
  commission_type     text         NOT NULL DEFAULT 'percentage'
                                   CHECK (commission_type IN ('flat','percentage','tiered')),
  commission_rate     numeric(6,4) NOT NULL DEFAULT 0.0000,
  flat_amount         numeric(12,2),
  tier_config         jsonb,       -- for tiered: [{min_amount, max_amount, rate}]
  settlement_method   text         NOT NULL DEFAULT 'daily_wallet'
                                   CHECK (settlement_method IN ('instant_wallet','daily_wallet','bank_payout')),
  is_active           boolean      NOT NULL DEFAULT true,
  effective_from      date         NOT NULL DEFAULT CURRENT_DATE,
  effective_to        date,
  created_by          uuid         NOT NULL,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- vendor_bank_accounts
-- ============================================================
CREATE TABLE vendor_bank_accounts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id       uuid        NOT NULL REFERENCES vendor_organizations(id),
  bank_name       text        NOT NULL,
  account_name    text        NOT NULL,
  account_number  text        NOT NULL,  -- stored encrypted, masked in responses
  sort_code       text,
  is_primary      boolean     NOT NULL DEFAULT false,
  verified        boolean     NOT NULL DEFAULT false,
  verified_by     uuid,
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### 5.2 Ledger Tables

```sql
-- ============================================================
-- ledger_accounts
-- ============================================================
CREATE TABLE ledger_accounts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code    text        UNIQUE NOT NULL,
  account_name    text        NOT NULL,
  account_type    text        NOT NULL
                              CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  normal_balance  text        NOT NULL CHECK (normal_balance IN ('debit','credit')),
  wallet_id       uuid        REFERENCES vendor_wallets(id),  -- null for platform accounts
  is_platform     boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Required accounts per wallet (provisioned automatically on wallet creation)
-- vendor_float          (asset, debit normal)
-- vendor_reserved       (asset, debit normal)
-- vendor_commission_payable (liability, credit normal)
-- vendor_credit_utilised (liability, credit normal)
-- Platform accounts (created once, shared):
-- platform_cash_clearing (asset, debit normal)
-- platform_sales_revenue (revenue, credit normal)
-- platform_commission_expense (expense, debit normal)
-- platform_suspense (liability, credit normal)

-- ============================================================
-- ledger_journals
-- ============================================================
CREATE TABLE ledger_journals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_type    text        NOT NULL
                              CHECK (journal_type IN (
                                'funding_credit','purchase_reservation',
                                'purchase_final','purchase_release',
                                'commission_accrual','commission_settlement',
                                'reversal','manual_adjustment','settlement'
                              )),
  source_type     text        NOT NULL,  -- 'funding_request','purchase_order','reversal_case', etc.
  source_id       uuid        NOT NULL,
  site_code       text        NOT NULL,
  business_date   date        NOT NULL,
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','posted','voided')),
  idempotency_key text        UNIQUE NOT NULL,
  posted_at       timestamptz,
  created_by      uuid        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_journals_source ON ledger_journals(source_type, source_id);
CREATE INDEX idx_ledger_journals_date ON ledger_journals(business_date);
CREATE INDEX idx_ledger_journals_status ON ledger_journals(status);

-- ============================================================
-- ledger_entries
-- ============================================================
CREATE TABLE ledger_entries (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id      uuid         NOT NULL REFERENCES ledger_journals(id),
  account_id      uuid         NOT NULL REFERENCES ledger_accounts(id),
  entry_side      text         NOT NULL CHECK (entry_side IN ('debit','credit')),
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  currency_code   text         NOT NULL DEFAULT 'NGN',
  reference_type  text,
  reference_id    uuid,
  metadata        jsonb        NOT NULL DEFAULT '{}',
  created_at      timestamptz  NOT NULL DEFAULT now()
  -- NO updated_at — entries are immutable
);

CREATE INDEX idx_ledger_entries_journal ON ledger_entries(journal_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id);

-- ============================================================
-- wallet_balance_snapshots
-- ============================================================
CREATE TABLE wallet_balance_snapshots (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id        uuid         NOT NULL REFERENCES vendor_wallets(id),
  posted_float     numeric(14,2) NOT NULL DEFAULT 0.00,
  reserved_amount  numeric(14,2) NOT NULL DEFAULT 0.00,
  commission_payable numeric(14,2) NOT NULL DEFAULT 0.00,
  credit_limit     numeric(14,2) NOT NULL DEFAULT 0.00,
  credit_utilized  numeric(14,2) NOT NULL DEFAULT 0.00,
  holds            numeric(14,2) NOT NULL DEFAULT 0.00,
  snapshot_at      timestamptz  NOT NULL DEFAULT now(),
  journal_id       uuid         REFERENCES ledger_journals(id)
  -- available_balance is computed: posted_float - reserved_amount + credit_limit - credit_utilized - holds
);

CREATE INDEX idx_balance_snapshot_wallet ON wallet_balance_snapshots(wallet_id, snapshot_at DESC);
```

### 5.3 Transaction Tables

```sql
-- ============================================================
-- wallet_funding_requests
-- ============================================================
CREATE TABLE wallet_funding_requests (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           uuid         NOT NULL REFERENCES vendor_organizations(id),
  wallet_id           uuid         NOT NULL REFERENCES vendor_wallets(id),
  site_code           text         NOT NULL,
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  currency_code       text         NOT NULL DEFAULT 'NGN',
  channel             text         NOT NULL
                                   CHECK (channel IN ('bank_transfer','cash_branch','payment_gateway','internal_transfer')),
  status              text         NOT NULL DEFAULT 'initiated'
                                   CHECK (status IN (
                                     'initiated','awaiting_proof','under_review',
                                     'confirmed','posted','rejected','expired','cancelled'
                                   )),
  funding_reference   text         UNIQUE NOT NULL,
  external_bank_ref   text,
  proof_document_path text,
  proof_uploaded_at   timestamptz,
  reviewer_id         uuid,
  reviewer_note       text,
  reviewed_at         timestamptz,
  posted_journal_id   uuid         REFERENCES ledger_journals(id),
  expires_at          timestamptz,
  idempotency_key     text         UNIQUE NOT NULL,
  requested_by        uuid         NOT NULL,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT unique_external_bank_ref UNIQUE (external_bank_ref) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_funding_vendor ON wallet_funding_requests(vendor_id);
CREATE INDEX idx_funding_status ON wallet_funding_requests(status);

-- ============================================================
-- wallet_purchase_orders
-- ============================================================
CREATE TABLE wallet_purchase_orders (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id              uuid         NOT NULL REFERENCES vendor_organizations(id),
  wallet_id              uuid         NOT NULL REFERENCES vendor_wallets(id),
  site_code              text         NOT NULL,
  meter_sn               text         NOT NULL,
  customer_id            text,
  customer_name          text,
  delivery_method        text         NOT NULL
                                      CHECK (delivery_method IN ('remote_send','token_generate')),
  delivery_destination   text,        -- meter_sn for remote_send, null for token_generate
  amount                 numeric(14,2) NOT NULL CHECK (amount > 0),
  fee_amount             numeric(14,2) NOT NULL DEFAULT 0.00,
  commission_amount      numeric(14,2) NOT NULL DEFAULT 0.00,
  net_debit_amount       numeric(14,2) NOT NULL,
  status                 text         NOT NULL DEFAULT 'pending'
                                      CHECK (status IN (
                                        'pending','reserved','processing',
                                        'successful','failed','reversed','manual_review'
                                      )),
  token_value            text,        -- populated only for token_generate success
  remote_send_ref        text,        -- upstream delivery reference for remote_send
  idempotency_key        text         UNIQUE NOT NULL,
  upstream_request_ref   text,
  upstream_transaction_id text,
  token_transaction_id   uuid,
  receipt_ref            uuid,
  request_payload        jsonb,
  response_payload       jsonb,
  failure_reason         text,
  failure_code           text,
  reserved_journal_id    uuid         REFERENCES ledger_journals(id),
  final_journal_id       uuid         REFERENCES ledger_journals(id),
  requested_by           uuid         NOT NULL,
  completed_at           timestamptz,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_vendor ON wallet_purchase_orders(vendor_id);
CREATE INDEX idx_purchase_wallet ON wallet_purchase_orders(wallet_id);
CREATE INDEX idx_purchase_status ON wallet_purchase_orders(status);
CREATE INDEX idx_purchase_meter ON wallet_purchase_orders(meter_sn);
CREATE INDEX idx_purchase_created ON wallet_purchase_orders(created_at);

-- ============================================================
-- wallet_receipts
-- ============================================================
CREATE TABLE wallet_receipts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid        NOT NULL REFERENCES wallet_purchase_orders(id),
  vendor_id         uuid        NOT NULL REFERENCES vendor_organizations(id),
  site_code         text        NOT NULL,
  delivery_method   text        NOT NULL CHECK (delivery_method IN ('remote_send','token_generate')),
  meter_sn          text        NOT NULL,
  customer_ref      text,
  customer_name     text,
  amount            numeric(14,2) NOT NULL,
  token_value       text,       -- null for remote_send; masked in list views
  remote_send_ref   text,       -- null for token_generate
  issued_at         timestamptz NOT NULL DEFAULT now(),
  receipt_number    text        UNIQUE NOT NULL,
  issued_by         uuid        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
  -- No updated_at — receipts are immutable
);

CREATE INDEX idx_receipts_vendor ON wallet_receipts(vendor_id);
CREATE INDEX idx_receipts_purchase ON wallet_receipts(purchase_order_id);
CREATE INDEX idx_receipts_number ON wallet_receipts(receipt_number);

CREATE SEQUENCE receipt_number_seq START 100000 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text LANGUAGE sql AS $$
  SELECT 'RCP-' || TO_CHAR(NOW() AT TIME ZONE 'Africa/Lagos', 'YYYYMMDD')
         || '-' || LPAD(nextval('receipt_number_seq')::text, 6, '0');
$$;

-- ============================================================
-- wallet_reversal_cases
-- ============================================================
CREATE TABLE wallet_reversal_cases (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   uuid        NOT NULL REFERENCES wallet_purchase_orders(id),
  vendor_id           uuid        NOT NULL REFERENCES vendor_organizations(id),
  wallet_id           uuid        NOT NULL REFERENCES vendor_wallets(id),
  reversal_type       text        NOT NULL
                                  CHECK (reversal_type IN ('full','partial')),
  amount              numeric(14,2) NOT NULL,
  reason_code         text        NOT NULL,
  reason_description  text        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected','posted','cancelled')),
  maker_id            uuid,
  checker_id          uuid,
  maker_at            timestamptz,
  checker_at          timestamptz,
  reversal_journal_id uuid        REFERENCES ledger_journals(id),
  token_was_used      boolean,
  upstream_confirmed  boolean,
  idempotency_key     text        UNIQUE NOT NULL,
  requested_by        uuid        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- wallet_reconciliation_runs
-- ============================================================
CREATE TABLE wallet_reconciliation_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type        text        NOT NULL CHECK (run_type IN ('intraday','end_of_day')),
  site_code       text,       -- null = all sites
  business_date   date        NOT NULL,
  status          text        NOT NULL DEFAULT 'running'
                              CHECK (status IN ('running','completed','failed','partial')),
  l1_status       text,
  l2_status       text,
  l3_status       text,
  l4_status       text,
  l5_status       text,
  exceptions_found integer    NOT NULL DEFAULT 0,
  exceptions_resolved integer NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  run_metadata    jsonb       NOT NULL DEFAULT '{}'
);

-- ============================================================
-- wallet_exceptions
-- ============================================================
CREATE TABLE wallet_exceptions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_type  text        NOT NULL CHECK (exception_type IN (
                                'funding_unmatched','purchase_stuck_reserved',
                                'upstream_success_local_fail','local_success_upstream_missing',
                                'commission_mismatch','duplicate_payment_reference',
                                'balance_snapshot_drift','device_anomaly',
                                'rapid_purchase_flag','manual_review_required'
                              )),
  severity        text        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status          text        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','assigned','in_progress','resolved','escalated','closed')),
  vendor_id       uuid        REFERENCES vendor_organizations(id),
  wallet_id       uuid        REFERENCES vendor_wallets(id),
  site_code       text,
  reference_type  text,
  reference_id    uuid,
  description     text        NOT NULL,
  resolution_code text,
  resolution_note text,
  assigned_to     uuid,
  assigned_at     timestamptz,
  sla_deadline    timestamptz NOT NULL,
  resolved_by     uuid,
  resolved_at     timestamptz,
  recon_run_id    uuid        REFERENCES wallet_reconciliation_runs(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exceptions_status ON wallet_exceptions(status);
CREATE INDEX idx_exceptions_severity ON wallet_exceptions(severity);
CREATE INDEX idx_exceptions_vendor ON wallet_exceptions(vendor_id);
CREATE INDEX idx_exceptions_sla ON wallet_exceptions(sla_deadline);

-- ============================================================
-- wallet_settlement_batches
-- ============================================================
CREATE TABLE wallet_settlement_batches (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code               text         NOT NULL,
  business_date           date         NOT NULL,
  status                  text         NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending','processing','completed','failed','locked')),
  opening_total_float     numeric(14,2) NOT NULL DEFAULT 0.00,
  total_funding_posted    numeric(14,2) NOT NULL DEFAULT 0.00,
  total_purchases         numeric(14,2) NOT NULL DEFAULT 0.00,
  total_reversals         numeric(14,2) NOT NULL DEFAULT 0.00,
  total_commission_accrued numeric(14,2) NOT NULL DEFAULT 0.00,
  total_commission_settled numeric(14,2) NOT NULL DEFAULT 0.00,
  closing_total_float     numeric(14,2) NOT NULL DEFAULT 0.00,
  vendor_count            integer       NOT NULL DEFAULT 0,
  purchase_count          integer       NOT NULL DEFAULT 0,
  exception_count         integer       NOT NULL DEFAULT 0,
  executed_by             uuid,
  locked_at               timestamptz,
  locked_by               uuid,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (site_code, business_date)
);

-- ============================================================
-- approval_requests (maker-checker)
-- ============================================================
CREATE TABLE approval_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type   text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected','expired')),
  payload       jsonb       NOT NULL,
  maker_id      uuid        NOT NULL,
  maker_role    text        NOT NULL,
  checker_id    uuid,
  checker_role  text,
  maker_note    text,
  checker_note  text,
  maker_at      timestamptz NOT NULL DEFAULT now(),
  checker_at    timestamptz,
  expires_at    timestamptz NOT NULL,
  reference_type text,
  reference_id   uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

---

## 6. RBAC and RLS — Complete Specification

### 6.1 JWT Claim Structure

```json
{
  "sub": "auth_user_uuid",
  "app_role": "vendor_user",
  "site_code": "SITE_001",
  "vendor_id": "vendor_uuid_or_null",
  "session_id": "session_uuid",
  "iat": 1234567890,
  "exp": 1234567890
}
```

The `app_role` claim is set by a Supabase Auth hook on login. The Express middleware validates the JWT and attaches the claims to `req.user`.

### 6.2 Role Definitions

| Role | Description |
|---|---|
| `super_admin` | Full system access. No scope restriction. |
| `admin` | System administration. Can create credentials. Cannot post manual journal entries. |
| `finance` | Wallet funding approval, reversals, manual adjustments, reconciliation, settlement. |
| `ops_manager` | Vendor management, suspension, exception resolution. Site-scoped. |
| `field_agent` | Vendor onboarding support, document collection. Site-scoped. Read-mostly. |
| `vendor_manager` | Manages vendor portal for their vendor org. Can view reports. Cannot transact. |
| `vendor_user` | Purchases units, funds wallet, views own receipts and statements. |

### 6.3 Permission Matrix

| Action | super_admin | admin | finance | ops_manager | field_agent | vendor_manager | vendor_user |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Create user credentials | ✓ | ✓ | — | — | — | — | — |
| Create vendor profile | ✓ | ✓ | — | — | — | — | — |
| Edit vendor profile | ✓ | ✓ | — | site | — | — | — |
| Approve vendor onboarding | ✓ | ✓ | ✓ | — | — | — | — |
| Suspend vendor | ✓ | ✓ | — | site | — | — | — |
| Reactivate vendor | ✓ | ✓ | — | site | — | — | — |
| View all vendors | ✓ | ✓ | ✓ | site | site | own | — |
| Approve wallet funding | ✓ | ✓ | ✓ | — | — | — | — |
| Reject wallet funding | ✓ | ✓ | ✓ | — | — | — | — |
| View all wallets | ✓ | ✓ | ✓ | site | — | own | own |
| Initiate funding request | — | — | — | — | — | — | ✓ |
| Upload funding proof | — | — | — | — | — | — | ✓ |
| Cancel own funding request | — | — | — | — | — | — | ✓ |
| Purchase (remote send) | — | — | — | — | — | — | ✓ |
| Purchase (generate token) | — | — | — | — | — | — | ✓ |
| View own receipts | — | — | — | — | — | ✓ | ✓ |
| View all receipts | ✓ | ✓ | ✓ | site | — | — | — |
| Request reversal | — | — | — | — | — | — | ✓ |
| Approve reversal | ✓ | ✓ | ✓ | — | — | — | — |
| Post manual ledger adj. | ✓ | — | ✓ | — | — | — | — |
| View ledger entries | ✓ | ✓ | ✓ | — | — | — | — |
| Run reconciliation | ✓ | ✓ | ✓ | — | — | — | — |
| View exception board | ✓ | ✓ | ✓ | site | — | — | — |
| Resolve exceptions | ✓ | ✓ | ✓ | site | — | — | — |
| Edit commission rules | ✓ | — | ✓ | — | — | — | — |
| View commission summary | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| Approve credit limit | ✓ | — | ✓ (maker) | — | — | — | — |
| View finance dashboard | ✓ | ✓ | ✓ | — | — | — | — |
| Execute settlement batch | ✓ | — | ✓ | — | — | — | — |
| View audit logs | ✓ | ✓ | ✓ | site | — | — | — |

### 6.4 Complete RLS Policies

```sql
-- Enable RLS on all wallet tables
ALTER TABLE vendor_organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_wallets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_wallet_limits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_commission_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_bank_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_journals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balance_snapshots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_funding_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_purchase_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_receipts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_reversal_cases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_exceptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_settlement_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests          ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's app_role from JWT
CREATE OR REPLACE FUNCTION current_app_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() ->> 'app_role', '');
$$;

-- Helper function to get current user's site_code from JWT
CREATE OR REPLACE FUNCTION current_site_code()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() ->> 'site_code', '');
$$;

-- Helper function to get current user's vendor_id from JWT
CREATE OR REPLACE FUNCTION current_vendor_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() ->> 'vendor_id')::uuid;
$$;

-- ============================================================
-- vendor_wallets
-- ============================================================
CREATE POLICY "wallet_read" ON vendor_wallets FOR SELECT USING (
  current_app_role() IN ('super_admin','admin','finance')
  OR (current_app_role() = 'ops_manager'
      AND vendor_id IN (SELECT id FROM vendor_organizations WHERE site_code = current_site_code()))
  OR vendor_id = current_vendor_id()
);
CREATE POLICY "wallet_insert_service" ON vendor_wallets FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "wallet_update_service" ON vendor_wallets FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "wallet_no_delete" ON vendor_wallets FOR DELETE USING (false);

-- ============================================================
-- customers / meters (site-scoped for vendors)
-- ============================================================
-- Apply to your existing customers table:
CREATE POLICY "customer_vendor_site_scope" ON customers FOR SELECT USING (
  current_app_role() IN ('super_admin','admin','finance','ops_manager')
  OR site_code = current_site_code()
);

-- ============================================================
-- ledger_entries (immutable, service-role only for writes)
-- ============================================================
CREATE POLICY "ledger_entries_read" ON ledger_entries FOR SELECT USING (
  current_app_role() IN ('super_admin','admin','finance')
  OR auth.role() = 'service_role'
);
CREATE POLICY "ledger_entries_insert_service" ON ledger_entries FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "ledger_entries_no_update" ON ledger_entries FOR UPDATE USING (false);
CREATE POLICY "ledger_entries_no_delete" ON ledger_entries FOR DELETE USING (false);

-- ============================================================
-- wallet_funding_requests
-- ============================================================
CREATE POLICY "funding_read" ON wallet_funding_requests FOR SELECT USING (
  current_app_role() IN ('super_admin','admin','finance')
  OR (current_app_role() = 'ops_manager' AND site_code = current_site_code())
  OR vendor_id = current_vendor_id()
);
CREATE POLICY "funding_vendor_insert" ON wallet_funding_requests FOR INSERT WITH CHECK (
  vendor_id = current_vendor_id()
  AND current_app_role() = 'vendor_user'
);
CREATE POLICY "funding_service_update" ON wallet_funding_requests FOR UPDATE USING (
  auth.role() = 'service_role'
  OR current_app_role() IN ('super_admin','admin','finance')
);
CREATE POLICY "funding_no_delete" ON wallet_funding_requests FOR DELETE USING (false);

-- ============================================================
-- wallet_purchase_orders
-- ============================================================
CREATE POLICY "purchase_read" ON wallet_purchase_orders FOR SELECT USING (
  current_app_role() IN ('super_admin','admin','finance')
  OR (current_app_role() = 'ops_manager' AND site_code = current_site_code())
  OR vendor_id = current_vendor_id()
);
CREATE POLICY "purchase_vendor_insert" ON wallet_purchase_orders FOR INSERT WITH CHECK (
  vendor_id = current_vendor_id()
  AND current_app_role() = 'vendor_user'
);
CREATE POLICY "purchase_service_update" ON wallet_purchase_orders FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "purchase_no_delete" ON wallet_purchase_orders FOR DELETE USING (false);

-- ============================================================
-- wallet_receipts (immutable)
-- ============================================================
CREATE POLICY "receipts_read" ON wallet_receipts FOR SELECT USING (
  current_app_role() IN ('super_admin','admin','finance')
  OR (current_app_role() IN ('ops_manager','vendor_manager') AND site_code = current_site_code())
  OR vendor_id = current_vendor_id()
);
CREATE POLICY "receipts_service_insert" ON wallet_receipts FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "receipts_no_update" ON wallet_receipts FOR UPDATE USING (false);
CREATE POLICY "receipts_no_delete" ON wallet_receipts FOR DELETE USING (false);

-- ============================================================
-- audit_logs (append-only for all roles)
-- ============================================================
CREATE POLICY "audit_read" ON audit_logs FOR SELECT USING (
  current_app_role() IN ('super_admin','admin','finance')
  OR (current_app_role() = 'ops_manager' AND site_code = current_site_code())
);
CREATE POLICY "audit_insert_service" ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "audit_no_update" ON audit_logs FOR UPDATE USING (false);
CREATE POLICY "audit_no_delete" ON audit_logs FOR DELETE USING (false);
```

---

## 7. Phase 0 — Foundation

### Goal
Establish the complete infrastructure foundation: database schema, RLS policies, JWT claim structure, RBAC middleware, audit integration, and admin credential creation flow. Nothing financial is live at the end of this phase. The foundation is ready for building on.

### Task List

#### Database
- [ ] Write and apply migration `001_wallet_foundation.sql` — all tables, constraints, indexes, sequences
- [ ] Write and apply migration `002_wallet_rls.sql` — all RLS policies and helper functions
- [ ] Write and apply migration `003_wallet_functions.sql` — `generate_receipt_number()`, `compute_available_balance()`, `update_balance_snapshot()` trigger
- [ ] Write and apply migration `004_wallet_commission_seed.sql` — insert default commission rule with `rate = 0.0000` and `settlement_method = 'daily_wallet'`
- [ ] Verify: `ledger_entries` INSERT, UPDATE, DELETE blocked for non-service_role
- [ ] Verify: `wallet_receipts` UPDATE, DELETE blocked for all roles
- [ ] Verify: `audit_logs` UPDATE, DELETE blocked for all roles including service_role

#### Backend Foundation
- [ ] Implement `isWalletSchemaError(error)` guard function in `wallet-persistence.ts` — detects missing migration without spamming logs
- [ ] Implement `verifyWalletSchemaReady(supabase)` startup check — returns false in degraded mode, throws on unexpected errors
- [ ] Implement 503 response middleware for wallet routes when schema is not ready
- [ ] Add `app_role`, `site_code`, `vendor_id`, `session_id` to Supabase Auth JWT custom claims via Auth hook
- [ ] Implement RBAC middleware for Express: validate JWT, extract claims, attach to `req.user`
- [ ] Implement site-scope validation middleware: rejects requests where `req.body.site_code` does not match `req.user.site_code` for vendor roles
- [ ] Wire `audit_logs` write service — single function called from every sensitive route, non-blocking, fails silently with error log (never fails the request)
- [ ] Implement `X-Idempotency-Key` enforcement middleware — 400 on missing key for financial POST routes
- [ ] Implement idempotency key storage and replay detection in `wallet-persistence.ts`
- [ ] Implement rate limiting middleware (global + per-endpoint tiers)

#### Admin Credential Creation Flow
- [ ] `POST /api/admin/users/create` — creates Supabase Auth user with temporary password, assigns `app_role`, `site_code`, `vendor_id` claims
- [ ] Enforce 72-hour expiry on temporary passwords (use Auth hook to flag `pending_password_reset`)
- [ ] Return credentials to admin in API response (plaintext temp password shown once, never stored)
- [ ] Write `vendor_users` row on credential creation
- [ ] Write audit log entry: `credential_created`
- [ ] Admin UI: credential creation form — username, temporary password (auto-generated), role selector, site selector
- [ ] Admin UI: created credential confirmation screen with copy-to-clipboard (shown once)

#### Security Baseline
- [ ] Configure CORS whitelist in Express
- [ ] Add security headers middleware: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- [ ] Configure Supabase Storage bucket for KYC documents as private with signed URL access
- [ ] Implement file upload MIME type validation (accept only PDF, JPG, PNG for KYC)
- [ ] Configure login rate limiting: 5 attempts per 10 minutes, 15-minute lockout
- [ ] Implement forced password change gate: `vendor_user` with `status = 'pending_password_reset'` returns 403 with `FORCE_PASSWORD_CHANGE` code on all wallet routes
- [ ] Implement device fingerprint capture on frontend (user agent + accept-language + viewport), sent as `X-Device-Fingerprint` header

#### Exit Criteria
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] RLS tests: vendor_user with site A cannot read vendor records from site B
- [ ] RLS tests: client cannot insert, update, or delete `ledger_entries`
- [ ] RLS tests: client cannot delete `wallet_receipts` or `audit_logs`
- [ ] JWT claim test: login returns token containing `app_role`, `site_code`, `vendor_id`
- [ ] Idempotency test: duplicate key on financial POST returns 409 with original result
- [ ] Rate limit test: 6th login attempt returns 429
- [ ] Schema guard test: wallet routes return 503 when `vendor_wallets` table is dropped

---

## 8. Phase 1 — Onboarding and Wallet Provisioning

### Goal
Admin can create a vendor with credentials. Vendor logs in, changes password, completes onboarding form. Finance approves. Wallet is provisioned automatically. Vendor portal shell loads with a zero balance card.

### Task List

#### Vendor Onboarding Flow (Backend)
- [ ] `POST /api/vendor/create` — creates vendor_organization in `draft` status, writes audit log
- [ ] `POST /api/vendor/:id/submit` — transitions vendor to `pending_review`, validates all required fields are present
- [ ] `POST /api/vendor/:id/approve` — finance/admin role, transitions to `approved`, triggers wallet provisioning
- [ ] `POST /api/vendor/:id/reject` — with required reason, transitions to `rejected`
- [ ] `POST /api/vendor/:id/activate` — transitions from `approved` to `active` (can be same step as approve or separate go-live gate)
- [ ] `POST /api/vendor/:id/suspend` — ops_manager or admin, requires reason, sets `suspended_at`, `suspension_reason`
- [ ] `POST /api/vendor/:id/reactivate` — clears suspension, writes audit log with approver
- [ ] `GET /api/vendor/list` — paginated, filterable by status, site, name; site-scoped for ops roles
- [ ] `GET /api/vendor/:id` — full vendor profile including kyc_status, risk_rating, current wallet status
- [ ] `POST /api/vendor/:id/bank-account` — adds bank account, masked in responses
- [ ] KYC document upload: `POST /api/vendor/:id/documents` — stores to Supabase Storage private bucket, records path in `documents` table

#### Wallet Provisioning (Backend)
- [ ] `wallet-persistence.ts`: `provisionWallet(vendorId)` — called automatically on vendor approval
  - Creates `vendor_wallets` row
  - Generates wallet number: `WLT-{SITE}-{6-digit-seq}`
  - Creates ledger accounts: `vendor_float`, `vendor_reserved`, `vendor_commission_payable`
  - Creates `vendor_wallet_limits` row with defaults
  - Creates `wallet_balance_snapshots` row with all zeros
  - Creates `vendor_commission_rules` row with `rate = 0.0000`
  - Writes audit log: `wallet_provisioned`
- [ ] Wallet number sequence: one per site, collision-safe, stored in `wallet_number_seq_{site_code}` sequences
- [ ] `wallet-domain-store.ts`: cache new wallet in in-memory map after provisioning

#### Vendor Portal — First Login Flow (Frontend)
- [ ] Login page: username and password fields, ACOB branding, no self-registration link
- [ ] On login: check JWT for `status = 'pending_password_reset'`
- [ ] Force password change modal: current (temp) password, new password, confirm new password; validate policy (12 chars, uppercase, digit, symbol); submit calls `PATCH /api/auth/password`
- [ ] After password change: update `vendor_users.status` to `active`, redirect to onboarding form
- [ ] If vendor onboarding not yet submitted: show onboarding form (cannot skip to dashboard)

#### Vendor Onboarding Form (Frontend)
- [ ] Step 1 — Business Details: legal name, display name, registration number, tax ID, address
- [ ] Step 2 — Contact: primary contact name, phone, email
- [ ] Step 3 — Bank Account: bank name, account name, account number, sort code
- [ ] Step 4 — Documents: KYC upload (drag-and-drop or file select), accepts PDF/JPG/PNG, max 5MB per file
- [ ] Step 5 — Review and Submit: summary of all entered data, submit button
- [ ] Form saves progress on each step (PUT to `pending` profile, not final submit)
- [ ] Show "Under Review" holding page after submission with estimated review timeline
- [ ] Show "Approved — Your wallet is ready" notification on approval

#### Finance Approval Queue (Frontend — Internal)
- [ ] Vendor approval queue page: list of vendors in `pending_review` status
- [ ] Each row: vendor name, site, submitted date, KYC status, submitted documents count
- [ ] Detail panel: full vendor profile, document viewer (signed URL), risk rating selector
- [ ] Approve button (with optional note) + Reject button (with mandatory reason)
- [ ] After approve: vendor moves to `approved`, wallet provisioned, vendor notified
- [ ] After reject: vendor moves to `rejected`, rejection reason displayed to vendor on next login

#### Modal Specifications
**Reject Vendor Modal:**
- Title: "Reject vendor application"
- Required field: rejection reason (text area, min 20 chars)
- Warning: "The vendor will be notified and cannot reapply without admin action"
- Buttons: Cancel / Confirm Rejection (destructive style)

**Suspend Vendor Modal:**
- Title: "Suspend vendor account"
- Required field: suspension reason (select from list + optional free text)
  - Reason options: Compliance issue, Suspicious activity, Customer complaint, KYC expired, Manual review
- Warning: "All purchases will be blocked immediately. Outstanding reservations are preserved."
- Buttons: Cancel / Confirm Suspension

**Reactivate Vendor Modal:**
- Title: "Reactivate vendor account"
- Show: suspension reason, suspended since date
- Required field: reactivation note
- Buttons: Cancel / Confirm Reactivation

#### Exit Criteria
- [ ] Admin creates vendor + credentials → vendor logs in → forced password change completes
- [ ] Vendor completes onboarding form → finance sees it in review queue
- [ ] Finance approves → wallet created automatically with zero balance
- [ ] Vendor dashboard loads with zero balance card, "active" status badge
- [ ] Vendor with `suspended` status sees blocked dashboard with suspension message
- [ ] RLS: vendor cannot access other vendor's profile or wallet
- [ ] Document upload stores to private bucket, accessible only via signed URL

---

## 9. Phase 2 — Funding

### Goal
Vendor can initiate a funding request. Finance can review and approve or reject. Approved funding posts to the ledger. Vendor's wallet balance updates live. Duplicate bank references are blocked. Proof documents are stored.

### Task List

#### Funding Flow (Backend)
- [ ] `POST /api/wallet/funding/initiate` — creates `wallet_funding_requests` in `initiated` status
  - Validates: vendor is `active`, wallet is `active`, amount >= NGN 100, amount <= daily funding limit
  - Generates funding reference: `FND-{YYYYMMDD}-{6-digit-seq}`
  - Sets 72-hour expiry on the request
  - Idempotency key required
  - Writes audit log: `funding_initiated`
- [ ] `POST /api/wallet/funding/:id/upload-proof` — accepts file upload, validates MIME + size, stores to Supabase Storage, updates status to `awaiting_proof` → `under_review`, sets `proof_uploaded_at`
- [ ] `POST /api/wallet/funding/:id/approve` — finance role only
  - Validates: request is in `under_review` or `confirmed`
  - Creates ledger journal (`funding_credit` type)
  - Posts entries: debit `platform_cash_clearing`, credit `vendor_float`
  - Updates balance snapshot
  - Transitions status to `posted`
  - Writes audit log: `funding_approved`
  - Notifies vendor
- [ ] `POST /api/wallet/funding/:id/reject` — finance role, requires reason, transitions to `rejected`, writes audit log
- [ ] `POST /api/wallet/funding/:id/cancel` — vendor role, only when status is `initiated` or `awaiting_proof`
- [ ] `GET /api/wallet/funding/pending` — finance role, list of requests in `under_review`
- [ ] `GET /api/wallet/:walletId/funding/history` — paginated, filterable by status and date
- [ ] Duplicate bank reference: unique constraint on `external_bank_ref`; if vendor enters same bank ref on a second request, return 409 with `DUPLICATE_BANK_REFERENCE` code
- [ ] Expiry job: funding requests not confirmed within 72 hours auto-transition to `expired` (handled by reconciliation engine)

#### Balance Snapshot Update
- [ ] `wallet-ledger.ts`: `updateBalanceSnapshot(walletId, journalId)` — called after every ledger post
  - Re-derives all snapshot fields from summing posted ledger entries (never manual field update)
  - Inserts new snapshot row (append-only, not update-in-place)
  - Updates in-memory domain store cache
- [ ] `compute_available_balance(snapshot)` — pure function defined once, imported everywhere:
  ```
  available = posted_float - reserved_amount + credit_limit - credit_utilized - holds
  ```

#### Wallet Summary API
- [ ] `GET /api/wallet/:walletId/summary` — returns:
  - `wallet_number`, `status`, `currency_code`
  - `posted_float`, `reserved_amount`, `available_balance` (computed)
  - `daily_purchase_limit`, `per_txn_limit`, `daily_spent_today`
  - `last_funded_at`, `last_purchase_at`
  - `pending_funding_count` (requests in `under_review`)

#### Vendor Portal — Funding Screens (Frontend)
- [ ] Top-Up page: amount input field (formatted NGN), channel selector (bank transfer / cash at branch), submit button
- [ ] On submit: show funding reference number prominently with copy-to-clipboard button
- [ ] Proof upload section: drag-and-drop area, accepted formats shown, max size shown, upload progress indicator
- [ ] Funding status tracker: stepper component showing: Initiated → Proof Uploaded → Under Review → Confirmed → Posted
- [ ] Funding history list: table with date, reference, amount, channel, status badge, view detail action
- [ ] Funding detail modal: all fields, proof document preview (signed URL), status history timeline

#### Finance — Funding Approval Screen (Frontend — Internal)
- [ ] Pending approvals list: sortable by amount, date, vendor name
- [ ] Each row: vendor name, wallet number, amount, channel, submitted date, proof status
- [ ] Detail panel: full funding request, inline document viewer (PDF/image), external bank reference input field (for bank transfer channel), reviewer notes field
- [ ] Approve button + Reject button
- [ ] Bulk approve: select multiple confirmed requests, approve all

#### Modal Specifications
**Approve Funding Modal:**
- Title: "Confirm funding approval"
- Show: vendor name, amount, channel, bank reference (if provided)
- Warning for amounts above NGN 1,000,000: "This is a large funding event. Verify bank reference independently."
- Reviewer note field (optional)
- Buttons: Cancel / Approve and Post to Wallet

**Reject Funding Modal:**
- Title: "Reject funding request"
- Required: rejection reason (select + free text)
  - Reason options: Proof unclear, Amount mismatch, Expired reference, Duplicate, Other
- Buttons: Cancel / Confirm Rejection

#### Exit Criteria
- [ ] Vendor initiates funding → reference number generated and displayed
- [ ] Vendor uploads proof → status moves to `under_review`
- [ ] Finance approves → ledger posted → balance updates immediately
- [ ] Available balance = posted_float (no reservations yet)
- [ ] Duplicate bank reference returns 409
- [ ] Expired request (72h) auto-transitioned by engine
- [ ] Statement shows the funded amount as a credit entry

---

## 10. Phase 3 — Purchase and Dual Delivery

### Goal
Vendor can search for a customer (site-scoped), enter an amount, choose delivery method (remote send or token generation), complete the purchase, and receive a numbered receipt. Failed purchases release reservations. Every successful purchase creates an immutable ledger debit. Commission accrual posts at zero amount.

### Task List

#### Pre-Purchase Validation (Backend — `wallet-purchase.ts`)
- [ ] Validate: vendor status is `active`
- [ ] Validate: wallet status is `active` (not frozen or suspended)
- [ ] Validate: available balance >= net_debit_amount
- [ ] Validate: amount >= `min_purchase_amount` from limits
- [ ] Validate: amount <= `per_txn_limit` from limits
- [ ] Validate: today's total purchases + amount <= `daily_purchase_limit` (sum from `wallet_purchase_orders` for today's business date)
- [ ] Validate: meter_sn belongs to a customer in vendor's `site_code` (site-scope enforcement)
- [ ] Validate: idempotency key is unique for this vendor + operation type
- [ ] All validation failures return 400 with structured error code + human-readable message

#### Remote Send Purchase Path (Backend — `wallet-purchase-remote.ts`)
- [ ] `POST /api/wallet/purchase/remote-send`
  1. Run pre-purchase validation
  2. Create `wallet_purchase_orders` row with `status = 'pending'`, `delivery_method = 'remote_send'`
  3. Post reservation journal: debit `vendor_reserved`, credit `vendor_float`; update snapshot; set `status = 'reserved'`
  4. Call upstream remote-send API (existing token platform route)
  5. On upstream success:
     - Store `upstream_transaction_id`, `remote_send_ref`, `response_payload`
     - Set `status = 'processing'` → `'successful'`
     - Post final sale journal: debit `platform_cash_clearing`, credit `vendor_reserved`; release reservation; update snapshot
     - Post commission accrual journal (zero amount in v1): debit `platform_commission_expense`, credit `vendor_commission_payable`
     - Generate receipt via `wallet-receipt.ts`; link `receipt_ref` to purchase order
     - Set `completed_at`; write audit log: `purchase_successful`
  6. On upstream failure:
     - Store `failure_reason`, `failure_code`, `response_payload`
     - Post reservation release journal: debit `vendor_float`, credit `vendor_reserved`; update snapshot
     - Set `status = 'failed'`; write audit log: `purchase_failed`
  7. Return receipt on success, structured error on failure

#### Token Generate Purchase Path (Backend — `wallet-purchase-token.ts`)
- [ ] `POST /api/wallet/purchase/generate-token`
  - Identical flow to remote-send except:
  - Upstream call is token generation endpoint
  - On success: store `token_value` in purchase order and receipt
  - Receipt includes `token_value` (full 20-digit code, masked in list views)

#### Reservation Release on Engine Restart
- [ ] `rehydrateInFlightOrders()` in engine startup — queries `wallet_purchase_orders` where status IN ('pending','reserved','processing') AND created_at < NOW() - STUCK_THRESHOLD (15 min); flags each for reconciliation review

#### Receipt Generation (`wallet-receipt.ts`)
- [ ] Generate unique receipt number using `generate_receipt_number()` SQL function
- [ ] Insert into `wallet_receipts` (immutable, no update ever)
- [ ] Map all fields correctly per delivery method (see receipt field spec in Part 5)
- [ ] `GET /api/wallet/receipt/:id` — full receipt for own receipt (vendor) or any receipt (admin/finance)
- [ ] `GET /api/wallet/receipt/:id/print` — returns receipt formatted for browser print (HTML response, print CSS)
- [ ] List view: `token_value` masked as `****-****-****-XXXX`; full value only on detail view

#### Commission Accrual (`wallet-commission.ts`)
- [ ] On every successful purchase, look up active commission rule for vendor (vendor-specific override first, then site default, then global default)
- [ ] Calculate commission: `amount * commission_rate` (result is 0.00 in v1 while rate = 0)
- [ ] Post `commission_accrual` journal whether amount is zero or not (confirms wiring is correct)
- [ ] Store `commission_amount` on purchase order
- [ ] Never block purchase if commission calculation fails — log error, continue with commission_amount = 0.00

#### Vendor Portal — Purchase Flow (Frontend)

**Step 1 — Find Meter:**
- [ ] Search input: type meter serial number or customer name
- [ ] Results are site-scoped (RLS enforces — no site selector shown to vendor)
- [ ] Result card: customer name, meter SN, meter type, account status badge, last vended date
- [ ] If meter not found: show "No results in your site" message with contact support link
- [ ] Vendor selects meter → proceeds to Step 2

**Step 2 — Amount and Delivery Method:**
- [ ] Amount input: NGN currency formatted, min/max shown below field
- [ ] Show available wallet balance in real time as vendor types (subtract from available)
- [ ] If amount > available balance: show inline warning "Insufficient balance — top up first" and disable proceed button
- [ ] Delivery method radio cards:
  - Card A — "Send to meter directly": description, best-for note, estimated delivery note
  - Card B — "Generate token code": description, best-for note, "customer enters manually" note
- [ ] Proceed button: "Continue to confirm"

**Step 3 — Confirm:**
- [ ] Summary: customer name, meter SN, amount, delivery method, available balance after purchase
- [ ] Prominent warning: "This action will debit your wallet immediately"
- [ ] Loading state on submit: spinner with "Processing your purchase..."
- [ ] Disable all buttons during processing (prevent double-submit)

**Step 4 — Receipt:**
- [ ] Remote send receipt layout (see Part 5 of this document)
- [ ] Token generation receipt layout (see Part 5 of this document)
- [ ] Print button: opens browser print dialog with receipt-formatted HTML
- [ ] "New Purchase" button: resets flow to Step 1
- [ ] "Go to Dashboard" button

**Insufficient Balance State:**
- [ ] On dashboard balance card: if available balance < NGN 1,000, show amber banner "Low balance — top up to continue purchasing"
- [ ] On purchase screen: if balance is zero, lock Step 2 and show "Your wallet is empty — request a top-up" with link to Top-Up page

#### Modal Specifications

**Purchase Confirmation Modal:**
- Title: "Confirm purchase"
- Show: all purchase details in a summary card
- Show: "Your wallet balance after this purchase: NGN X,XXX.XX"
- Show delivery method badge (Remote Send / Token)
- Buttons: Back / Confirm Purchase

**Purchase Failed Modal:**
- Title: "Purchase could not be completed"
- Show: failure reason (human-readable translation of failure_code)
- Show: "Your wallet reservation has been released. Your balance is unchanged."
- Show failure reference number for support
- Buttons: Try Again / Contact Support

**Reversal Request Modal:**
- Title: "Request a reversal"
- Show: original purchase details
- Required: reason for reversal (select: Token unreadable, Duplicate purchase, Wrong meter, Other)
- Info: "Reversals are reviewed by our finance team and processed within 1 business day"
- Buttons: Cancel / Submit Reversal Request

#### Exit Criteria
- [ ] Remote-send purchase debits wallet once, produces receipt with correct fields
- [ ] Token-generate purchase debits wallet once, produces receipt with token value
- [ ] Failed purchase releases reservation within one reconciliation cycle
- [ ] Upstream transaction reference stored on every purchase
- [ ] Vendor cannot query meters outside their site_code (tested directly)
- [ ] Commission journal created on every purchase (amount = 0.00 in v1)
- [ ] Receipt numbers are unique, sequential, and human-readable
- [ ] Duplicate idempotency key returns original result, no double-debit
- [ ] Insufficient balance returns 400 before any reservation is posted
- [ ] Daily limit exceeded returns 400 before any reservation is posted
- [ ] Concurrent purchase test: two simultaneous purchases against balance sufficient for one — only one succeeds

---

## 11. Phase 4 — Reconciliation and Exceptions

### Goal
The system automatically detects financial inconsistencies, creates exception cases with severity and SLA, and surfaces them to finance and ops. Finance and ops can view, assign, and resolve exceptions without database access. A locked daily reconciliation report is produced for each business date.

### Task List

#### Reconciliation Levels

**L1 — Ledger vs Balance Snapshot:**
- [ ] For each wallet, sum all posted ledger entries for `vendor_float` and `vendor_reserved`
- [ ] Compare to latest `wallet_balance_snapshots` row
- [ ] Tolerance: zero (any discrepancy is an exception)
- [ ] Exception type: `balance_snapshot_drift`, severity: `critical`

**L2 — Purchase Orders vs Upstream Token Records:**
- [ ] For each purchase order with `status = 'successful'`, verify `upstream_transaction_id` is populated
- [ ] For each purchase order with `upstream_transaction_id`, verify a corresponding token/send record exists in upstream platform
- [ ] Exception types: `local_success_upstream_missing` (severity: `critical`), `upstream_success_local_fail` (severity: `high`)

**L3 — Funding Requests vs Confirmation Records:**
- [ ] For each funding request with `status = 'posted'`, verify a `funding_credit` journal exists and is in `posted` status
- [ ] For each `posted` journal of type `funding_credit`, verify it has a corresponding `posted` funding request
- [ ] Exception type: `funding_unmatched`, severity: `high`

**L4 — Commission Accrual vs Settlement:**
- [ ] Sum `commission_amount` on all `successful` purchase orders for the business date
- [ ] Sum posted `commission_accrual` journal entries for the business date
- [ ] Compare; tolerance: zero
- [ ] Exception type: `commission_mismatch`, severity: `medium`

**L5 — Site/Day Operational Summary vs Settlement Batch:**
- [ ] For each completed settlement batch, verify the reported totals match the sum of purchase orders, funding requests, and reversals for that business date and site
- [ ] Exception type: `manual_review_required`, severity: `high`

#### Reconciliation Engine (`wallet-reconciliation-engine.ts`)
- [ ] Intraday run: every 10 minutes
  - Run L1 check on all active wallets
  - Detect stuck reservations: purchase orders in `reserved` or `processing` status older than 15 minutes
  - Detect duplicate idempotency keys (should never occur; if found it is `critical`)
  - Create exceptions for any new issues found
  - Skip wallets with no activity since last run (use `updated_at` filter)
- [ ] End-of-day run: triggered at 23:30 WAT for each site
  - Run all L1–L5 checks
  - Close business date: insert/update `wallet_settlement_batches` row with computed totals
  - Generate reconciliation report
  - Lock the settlement batch row (no further modifications to that date's data)
  - Escalate any unresolved `critical` or `high` exceptions via `wallet-exception-monitor.ts`
- [ ] Engine leadership: use existing runtime engine leadership pattern — only one node runs the engine at a time
- [ ] Engine startup: call `rehydrateInFlightOrders()` before first tick

#### Exception Management
- [ ] SLA assignment on creation:
  - `critical`: deadline = created_at + 15 minutes
  - `high`: deadline = created_at + 1 hour
  - `medium`: deadline = created_at + end of business day
  - `low`: deadline = created_at + 2 business days
- [ ] Auto-escalation: `wallet-exception-monitor.ts` runs every 5 minutes, escalates exceptions where `sla_deadline < NOW()` and `status IN ('open','assigned')`
- [ ] Escalation action: update status to `escalated`, write audit log, send notification to finance + admin

#### Exception API Routes
- [ ] `GET /api/reconciliation/exceptions` — paginated, filterable by severity, status, type, site, vendor, date range
- [ ] `GET /api/reconciliation/exceptions/:id` — full exception detail including linked purchase/funding record
- [ ] `POST /api/reconciliation/exceptions/:id/assign` — assign to a user, set status to `assigned`
- [ ] `POST /api/reconciliation/exceptions/:id/resolve` — resolution_code + resolution_note required; if compensating entry needed, payload includes journal data; status → `resolved`
- [ ] `GET /api/reconciliation/summary` — daily summary: total exceptions by severity, resolved count, pending count, oldest unresolved
- [ ] `POST /api/reconciliation/run` — manually trigger a reconciliation run (finance/admin)

#### Exception Board (Frontend — Internal)
- [ ] Main view: filterable table with severity badges, status badges, SLA countdown timers (amber when < 2h, red when breached)
- [ ] Columns: severity, type, vendor name, site, reference, description, SLA deadline, status, assigned to
- [ ] Row click: exception detail side panel
- [ ] Detail panel: full exception info, linked record data, resolution form
- [ ] Resolution form: resolution code selector, resolution note (required), compensating entry fields if applicable
- [ ] Assign button: assign to self or another user
- [ ] Daily summary card at top of page: total open, critical count, breached SLA count

#### Exit Criteria
- [ ] L1 check detects injected balance snapshot drift within 10 minutes
- [ ] Stuck reservation detected within 10 minutes of becoming stuck
- [ ] `upstream_success_local_fail` exception created for an injected test case
- [ ] Exception SLA timers count down correctly in UI
- [ ] Finance can view, assign, and resolve an exception end-to-end without database access
- [ ] Daily report produced and locked for a closed business date
- [ ] EOD report totals match the sum of all transactions for that date

---

## 12. Phase 5 — Commission and Settlement

### Goal
Commission accrual transitions from zero-amount placeholders to real values when the rate is activated. Daily settlement batch credits vendor wallets with earned commission. Finance can review and lock settlement. The commission settlement flow is fully auditable.

### Task List

#### Commission Rule Engine (`wallet-commission.ts`)
- [ ] `getActiveCommissionRule(vendorId, siteCode, date)` — lookup priority: vendor+site override > vendor global > site default > system default
- [ ] Support commission types: `percentage` (amount * rate), `flat` (fixed flat_amount per purchase), `tiered` (tier_config lookup)
- [ ] Commission rules have `effective_from` and `effective_to` dates — always use the rule active on the business date of the purchase, not the current date
- [ ] Rule change requires finance role; writes audit log: `commission_rule_changed`
- [ ] Rate change from 0 to non-zero activates real accrual — no schema change required

#### Settlement Engine (`wallet-settlement-engine.ts`)
- [ ] Triggered by EOD reconciliation run after L4 check passes
- [ ] For each vendor with accrued commission > 0 on the business date:
  - Sum `vendor_commission_payable` ledger entries for the business date
  - If `settlement_method = 'daily_wallet'`: post `commission_settlement` journal: debit `vendor_commission_payable`, credit `vendor_float`; update snapshot; notify vendor
  - If `settlement_method = 'bank_payout'`: create payout record for finance to process manually
  - If `settlement_method = 'instant_wallet'`: this would have been posted at purchase time — verify already settled
- [ ] Settlement batch totals updated: `total_commission_settled`
- [ ] Write audit log: `commission_settled` per vendor

#### Commission API Routes
- [ ] `GET /api/wallet/:walletId/commission/summary` — total accrued, total settled, unsettled balance, active rule summary
- [ ] `GET /api/wallet/:walletId/commission/history` — paginated list of commission accrual and settlement entries
- [ ] `GET /api/vendor/:id/commission/rule` — current active rule
- [ ] `PUT /api/vendor/:id/commission/rule` — update rule (finance role, writes approval_request if above threshold)
- [ ] `GET /api/reconciliation/settlement/:batchId` — full settlement batch report

#### Finance Dashboard (Frontend — Internal)
- [ ] KPI cards: Total Vendor Float (all active wallets), Total Reserved, Total Unsettled Commission, Today's Purchases (count + value), Failed Purchase Count (today), Reversal Rate (%), Wallets Near Exhaustion (< NGN 5,000 available)
- [ ] Top Vendors by Volume: bar chart, last 30 days
- [ ] Daily Activity Chart: purchase volume line chart, last 14 days
- [ ] Settlement batch list: date, site, status, total amounts, lock button
- [ ] Settlement batch detail: per-vendor breakdown, commission credited, lock/unlock action
- [ ] Commission rule management table: vendor, current rate, type, effective dates, edit action

#### Vendor Portal — Commission Section (Frontend)
- [ ] Commission summary card on vendor dashboard: "Earned commission this month: NGN X.XX (settled to wallet)"
- [ ] Commission history page: date, purchase reference, purchase amount, commission rate, commission amount, settlement status
- [ ] Note when rate = 0.00: "Commission program activating soon"

#### Exit Criteria
- [ ] Commission accrual posts correct non-zero amount when rate is changed to 1%
- [ ] Settlement batch credits vendor wallet with correct commission amount
- [ ] Settlement batch is locked and cannot be modified after locking
- [ ] Commission history on vendor portal shows correct entries
- [ ] Finance dashboard KPI cards load with accurate data

---

## 13. Phase 6 — Supabase-Authoritative Reads

### Goal
The system survives process restarts without any loss of financial state. All reads are authoritative from Supabase. The in-memory store is a warm cache only. In-flight orders from before a restart are rehydrated and handled correctly.

### Task List

#### Read Layer Implementation (`wallet-persistence.ts`)
- [ ] `readWalletFromSupabase(supabase, walletId)` — returns `VendorWallet | null`, uses `maybeSingle()`
- [ ] `readBalanceSnapshotFromSupabase(supabase, walletId)` — returns latest snapshot row
- [ ] `readFundingRequestFromSupabase(supabase, id)` — returns `FundingRequest | null`
- [ ] `readFundingRequestsByVendor(supabase, vendorId, filters)` — paginated, with status/date filters
- [ ] `readPurchaseOrderFromSupabase(supabase, id)` — returns `PurchaseOrder | null`
- [ ] `readPurchaseOrdersByWallet(supabase, walletId, filters)` — paginated, limit 200 default
- [ ] `readReceiptFromSupabase(supabase, id)` — returns `Receipt | null`
- [ ] `readReceiptsByVendor(supabase, vendorId, filters)` — paginated
- [ ] `readReconciliationRunFromSupabase(supabase, id)` — returns run details
- [ ] `readOpenExceptionsFromSupabase(supabase, filters)` — with severity/status/site filters
- [ ] `readCommissionRuleFromSupabase(supabase, vendorId, siteCode, date)` — active rule
- [ ] `readSettlementBatchFromSupabase(supabase, batchId)` — full batch with per-vendor breakdown
- [ ] `readVendorProfileFromSupabase(supabase, vendorId)` — full profile
- [ ] All read functions: apply `isWalletSchemaError` guard, return null on missing schema
- [ ] All read functions: explicit row-to-domain mapper (no raw Supabase shapes leak to domain layer)
- [ ] All list reads: include explicit `limit`, add cursor-based pagination for large collections

#### Domain Store Hydration (`wallet-domain-store.ts`)
- [ ] Every getter method: check in-memory cache first; on miss, query Supabase and populate cache
- [ ] Cache TTL for balance snapshots: 30 seconds (balance must be fresh for purchase validation)
- [ ] Cache TTL for commission rules: 5 minutes
- [ ] Cache TTL for vendor profiles: 60 seconds
- [ ] Cache invalidation: on every write/mirror operation, invalidate the relevant cache key

#### Balance Read Correctness
- [ ] `getAvailableBalance(walletId)` always reads from `wallet_balance_snapshots` (not re-summed from entries)
- [ ] `compute_available_balance(snapshot)` defined once as a pure function in `wallet-ledger.ts`
- [ ] The balance formula is imported and used identically in: purchase pre-check, wallet summary API, vendor dashboard, reconciliation engine

#### Startup Rehydration
- [ ] `rehydrateInFlightOrders()` — queries stuck orders (status IN pending/reserved/processing, created > 15 min ago); populates domain store; flags for reconciliation
- [ ] `rehydrateActiveWallets()` — loads all `active` wallets and their latest balance snapshots into cache on startup (prevents cold-start latency on first purchase)
- [ ] Both functions called in engine startup sequence before first reconciliation tick
- [ ] Startup integrity check: `verifyWalletSchemaReady()` called during service init; returns 503 on wallet routes if schema not ready

#### Restart Survival Tests
- [ ] Test: fund wallet → wipe in-memory store → `getWallet()` returns correct data from Supabase
- [ ] Test: create purchase order → wipe in-memory store → `getPurchaseOrder(id)` returns correct data
- [ ] Test: restart with stuck reservation → `rehydrateInFlightOrders()` flags it → reconciliation engine creates exception
- [ ] Test: cache miss → Supabase read → second call served from cache (mock Supabase, verify single call)
- [ ] Test: balance formula consistency — post known ledger entries, compute available balance, assert matches expected

#### Exit Criteria
- [ ] Process restart with funded vendor wallet: wallet balance correct after restart without any re-funding
- [ ] Process restart with in-flight purchase: stuck order detected and flagged within 15 minutes of restart
- [ ] No purchase double-debit possible under restart during upstream call
- [ ] All wallet summary API responses read from Supabase, not in-memory

---

## 14. Phase 7 — Hardening and Production Readiness

### Goal
The system is hardened against concurrent abuse, insider risk, operational errors, and infrastructure failures. Auto-suspension protects against anomalous behaviour. Maker-checker prevents unilateral high-risk actions. Load tests confirm no race conditions. Observability surfaces operational issues before customers notice.

### Task List

#### Maker-Checker Workflow
- [ ] `approval_requests` table: stores maker action, payload snapshot, expiry
- [ ] `POST /api/approvals/request` — maker submits; creates `approval_requests` row, notifies checker
- [ ] `POST /api/approvals/:id/approve` — checker approves; triggers the actual action; writes audit log
- [ ] `POST /api/approvals/:id/reject` — checker rejects; writes audit log; notifies maker
- [ ] Maker and checker must be different users (enforce: `checker_id != maker_id`)
- [ ] Approval requests expire after 24 hours if unchecked
- [ ] Apply to: reversal above NGN 50,000, manual ledger credit, credit limit activation, credit limit increase > 20%, wallet reactivation after fraud flag, settlement batch override

#### Auto-Suspension Triggers (`vendor-wallet-risk.ts`)
- [ ] Trigger: 3 consecutive rejected funding proof uploads → suspend wallet; create `critical` exception
- [ ] Trigger: reversal rate > 10% of purchases in rolling 7-day window → flag for review; create `high` exception
- [ ] Trigger: purchase from 3+ distinct IP addresses in one business day → create `high` exception
- [ ] Trigger: rapid-fire purchases: more than 5 purchases within 60 seconds → suspend wallet immediately; create `critical` exception
- [ ] Trigger: KYC expiry within 30 days → warn vendor and ops; on expiry day, suspend wallet; create `high` exception
- [ ] Trigger: purchase amount spike: single purchase > 3x the vendor's 30-day average → flag for review; create `medium` exception
- [ ] All auto-suspension events: write audit log, notify ops and finance immediately

#### Suspension Automation
- [ ] `POST /api/vendor/:id/auto-suspend` — internal service call only; logs trigger reason; transitions wallet to `frozen`
- [ ] Auto-suspend does not terminate in-flight reservations — they are preserved but cannot be added to
- [ ] Reactivation after auto-suspend requires ops + finance dual approval (maker-checker)

#### Risk Assessment and Limits
- [ ] `getRiskRating(vendorId)` — computes risk rating from: failed purchase rate, reversal rate, IP diversity, KYC status, days since last manual review
- [ ] Risk rating updates nightly: `low` / `medium` / `high` / `blocked`
- [ ] `blocked` rating auto-suspends wallet pending manual review
- [ ] Limits can be tightened automatically based on risk rating increase

#### Concurrency and Race Conditions
- [ ] Purchase reservation uses Postgres row-level locking (SELECT FOR UPDATE on wallet balance snapshot) to prevent double-debit under concurrent requests
- [ ] Test: simultaneous purchase requests for 2x available balance — exactly one succeeds, one gets 400 insufficient balance
- [ ] Test: simultaneous funding approval for the same request — exactly one posts, second gets idempotency replay
- [ ] Test: reconciliation run concurrent with purchase — reconciliation reads consistent snapshot

#### Load Testing
- [ ] 50 concurrent purchases from same wallet with sufficient balance — all 50 succeed, no duplicates
- [ ] 5 concurrent purchases from same wallet with balance sufficient for 3 — exactly 3 succeed, 2 return 400
- [ ] 100 requests per second against wallet summary endpoint — p99 < 300ms
- [ ] Reconciliation engine under 10,000 purchase orders — completes L1–L5 checks within 2 minutes

#### Failure Retry Logic
- [ ] Upstream call failure: reservation is released, purchase marked `failed`, vendor informed immediately
- [ ] Backend crash during upstream call: on restart, `rehydrateInFlightOrders()` flags stuck orders; reconciliation engine verifies upstream status; releases or finalises based on upstream result
- [ ] Supabase write failure during finalisation: idempotency key ensures safe retry; retry job posts with same key; no double-debit possible
- [ ] All retry logic: maximum 3 retries with exponential backoff (1s, 2s, 4s); after 3 failures, create `critical` exception

#### Observability
- [ ] Wallet-near-exhaustion alert: available balance < NGN 5,000 → notify vendor by in-app notification; notify ops by internal alert
- [ ] Exception SLA breach alert: `critical` exception unresolved after 15 minutes → notify finance + admin
- [ ] Daily reconciliation failure alert: if EOD run fails to complete by 00:00 WAT → notify admin
- [ ] Funding approval queue alert: more than 10 requests pending approval for > 4 hours → notify finance
- [ ] All alerts: written to `system_alerts` table; surfaced on admin notification bell in UI

#### Operational UI Additions
- [ ] Approval requests queue page (admin/finance): pending approvals, maker details, payload preview, approve/reject buttons
- [ ] Vendor risk page (ops): risk rating, trigger history, IP diversity chart, reversal rate trend
- [ ] System alerts panel in admin dashboard: unread alerts list, acknowledge action

#### Exit Criteria
- [ ] Maker-checker blocks large reversal without second approver
- [ ] Auto-suspend fires on 3 consecutive failed funding proofs; tested in integration
- [ ] Rapid-fire purchase trigger (5 in 60s) suspends wallet correctly
- [ ] Concurrent purchase test: no double-debit under simultaneous requests
- [ ] Retry with same idempotency key: no duplicate financial posting
- [ ] Load test: 50 concurrent purchases complete without error
- [ ] p99 latency < 300ms on wallet summary endpoint under load
- [ ] All critical alerts fire correctly in staging environment

---

## 15. API Contract — Complete Reference

### Base URL
```
/api
```

### Authentication
All routes require `Authorization: Bearer {JWT}` header.
Financial POST routes require `X-Idempotency-Key: {UUIDv4}` header.

### Response Envelope
All responses follow the existing `sendEnvelope` pattern:
```json
{
  "success": true,
  "data": { ... },
  "meta": { "request_id": "uuid", "timestamp": "ISO8601" }
}
```
Error responses:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Available balance is NGN 2,000.00, purchase requires NGN 5,000.00",
    "field": null
  }
}
```

### Vendor Routes
```
POST   /api/admin/users/create                    -- create credentials (admin)
POST   /api/vendor/create                         -- create vendor profile (admin)
PUT    /api/vendor/:id                            -- update vendor profile
POST   /api/vendor/:id/submit                     -- submit for review
POST   /api/vendor/:id/approve                    -- approve onboarding (finance/admin)
POST   /api/vendor/:id/reject                     -- reject application
POST   /api/vendor/:id/activate                   -- activate after approval
POST   /api/vendor/:id/suspend                    -- suspend vendor
POST   /api/vendor/:id/reactivate                 -- reactivate vendor
POST   /api/vendor/:id/bank-account               -- add bank account
POST   /api/vendor/:id/documents                  -- upload KYC document
GET    /api/vendor/list                           -- list vendors (paginated, filterable)
GET    /api/vendor/:id                            -- get vendor profile
GET    /api/vendor/:id/commission/rule            -- get active commission rule
PUT    /api/vendor/:id/commission/rule            -- update commission rule (finance)
```

### Wallet Routes
```
GET    /api/wallet/:walletId/summary              -- balance, status, limits
GET    /api/wallet/:walletId/statement            -- transaction history (paginated)
GET    /api/wallet/limits                         -- current limits for authenticated vendor
PUT    /api/wallet/limits/update                  -- update limits (finance/admin, maker-checker)
```

### Funding Routes
```
POST   /api/wallet/funding/initiate               -- create funding request
POST   /api/wallet/funding/:id/upload-proof       -- upload payment proof
POST   /api/wallet/funding/:id/approve            -- approve (finance)
POST   /api/wallet/funding/:id/reject             -- reject (finance)
POST   /api/wallet/funding/:id/cancel             -- cancel (vendor, if not yet reviewed)
GET    /api/wallet/funding/pending                -- pending approval queue (finance)
GET    /api/wallet/:walletId/funding/history      -- funding history
```

### Purchase Routes
```
POST   /api/wallet/purchase/remote-send           -- purchase with remote delivery
POST   /api/wallet/purchase/generate-token        -- purchase with token generation
GET    /api/wallet/purchase/:id                   -- get purchase order detail
GET    /api/wallet/:walletId/purchases            -- purchase history (paginated)
```

### Receipt Routes
```
GET    /api/wallet/receipt/:id                    -- get receipt detail
GET    /api/wallet/receipt/:id/print              -- printable receipt (HTML)
GET    /api/wallet/:walletId/receipts             -- receipt list (paginated)
```

### Reversal Routes
```
POST   /api/wallet/reversal/request               -- request reversal (vendor)
POST   /api/wallet/reversal/:id/approve           -- approve (finance, maker-checker if large)
POST   /api/wallet/reversal/:id/reject            -- reject (finance)
GET    /api/wallet/reversal/:id                   -- get reversal case
```

### Reconciliation Routes
```
GET    /api/reconciliation/summary                -- daily summary with KPIs
GET    /api/reconciliation/exceptions             -- exception list (paginated, filterable)
GET    /api/reconciliation/exceptions/:id         -- exception detail
POST   /api/reconciliation/exceptions/:id/assign  -- assign exception
POST   /api/reconciliation/exceptions/:id/resolve -- resolve exception
POST   /api/reconciliation/run                    -- manual reconciliation trigger
GET    /api/reconciliation/settlement/:batchId    -- settlement batch report
```

### Approval Routes
```
GET    /api/approvals/pending                     -- pending maker-checker approvals
POST   /api/approvals/:id/approve                 -- checker approves
POST   /api/approvals/:id/reject                  -- checker rejects
```

### Error Codes
```
INSUFFICIENT_BALANCE          -- available balance below purchase amount
DAILY_LIMIT_EXCEEDED          -- daily purchase limit reached
PER_TXN_LIMIT_EXCEEDED        -- single transaction limit exceeded
WALLET_FROZEN                 -- wallet is frozen
WALLET_SUSPENDED              -- wallet/vendor is suspended
VENDOR_NOT_ACTIVE             -- vendor status is not active
METER_NOT_IN_SITE             -- meter not in vendor's assigned site
DUPLICATE_IDEMPOTENCY_KEY     -- same key already processed (returns original result)
DUPLICATE_BANK_REFERENCE      -- external bank reference already used
INVALID_PROOF_FORMAT          -- uploaded file is wrong type or size
FUNDING_EXPIRED               -- funding request has expired
UPSTREAM_FAILURE              -- upstream token/send platform returned error
FORCE_PASSWORD_CHANGE         -- first login, must change password before proceeding
APPROVAL_REQUIRED             -- action requires maker-checker approval
SCHEMA_NOT_READY              -- wallet migration not yet applied
```

---

## 16. Frontend UI — Complete Screen Specifications

### Vendor Portal Navigation
```
/vendor/dashboard
/vendor/buy                     (purchase — step 1)
/vendor/buy/confirm             (purchase — step 2)
/vendor/buy/receipt/:id         (purchase — step 3 / receipt)
/vendor/transactions            (full history)
/vendor/receipts                (receipt archive)
/vendor/topup                   (funding request)
/vendor/topup/:id               (funding status)
/vendor/statement               (wallet statement)
/vendor/profile                 (account details — read-only)
/vendor/commission              (commission summary and history)
```

### Internal Staff Navigation
```
/admin/vendors                  (vendor list + approval queue)
/admin/vendors/:id              (vendor detail + actions)
/admin/wallets                  (all wallets overview)
/admin/wallets/:id              (wallet detail + ledger)
/admin/funding/pending          (funding approval queue)
/admin/funding/history          (all funding history)
/admin/purchases                (all purchase monitor)
/admin/reconciliation           (reconciliation summary + run)
/admin/exceptions               (exception board)
/admin/settlement               (settlement batches)
/admin/commission               (commission rules management)
/admin/approvals                (maker-checker queue)
/admin/risk                     (vendor risk panel)
/admin/finance                  (finance dashboard)
/admin/audit                    (audit log viewer)
```

### Receipt Field Specifications

**Remote Send Receipt — All Fields:**
```
Header:   ACOB Lighting Technology Ltd | Vending Receipt — Remote Delivery
Receipt:  Receipt No, Date and time (WAT), Transaction type: Remote Send
Vendor:   Vendor display name, Vendor code, Site name
Meter:    Meter serial number, Customer name, Account reference
Payment:  Amount sent (NGN formatted), Delivery reference (upstream tx ID)
Status:   DELIVERED ✓
Footer:   ACOB CRM3 | Support: [contact]
```

**Token Generation Receipt — All Fields:**
```
Header:   ACOB Lighting Technology Ltd | Vending Receipt — Token
Receipt:  Receipt No, Date and time (WAT), Transaction type: Token Generated
Vendor:   Vendor display name, Vendor code, Site name
Meter:    Meter serial number, Customer name, Account reference
Payment:  Amount purchased (NGN formatted)
Token:    [20-digit token displayed in 4-digit groups in a bordered box]
          Instructions: "Enter this code on your meter keypad"
Footer:   ACOB CRM3 | Support: [contact]
```

### Wallet Statement — Column Specification
```
Date/Time (WAT) | Reference | Type | Description | Debit (NGN) | Credit (NGN) | Balance After
```
Type values displayed: Fund Credit, Purchase Debit, Reversal Credit, Commission Credit, Manual Adjustment.
Export: CSV download, filename `statement_{wallet_number}_{from}_{to}.csv`.

---

## 17. Runtime Engines

### wallet-reconciliation-engine.ts
- **Schedule:** Intraday every 10 minutes; EOD at 23:30 WAT per site
- **Leadership:** Uses existing runtime engine leadership pattern — single node
- **Startup:** `rehydrateInFlightOrders()` + `rehydrateActiveWallets()` before first tick
- **Intraday responsibilities:** L1 balance drift check, stuck reservation detection, duplicate idempotency key detection
- **EOD responsibilities:** L1–L5 full checks, business date close, settlement batch creation, report generation and locking, exception escalation trigger
- **Failure handling:** Engine failure logged as `critical` system alert; does not crash the Node process

### wallet-settlement-engine.ts
- **Schedule:** Triggered by EOD reconciliation run after L4 passes
- **Responsibilities:** Compute per-vendor commission, post `commission_settlement` journals, update settlement batch totals, notify vendors
- **Failure handling:** Failed settlement creates `high` exception; finance can retry via API

### wallet-exception-monitor.ts
- **Schedule:** Every 5 minutes
- **Responsibilities:** Find exceptions past SLA deadline, escalate to `escalated` status, send notifications to finance + admin, write audit log per escalation
- **Alert channels:** In-app notification bell, `system_alerts` table insert, optional SMS/email integration hook

---

## 18. Testing Strategy

### Unit Tests
- [ ] `compute_available_balance()` — all combinations of float, reserved, credit, holds
- [ ] `getActiveCommissionRule()` — priority lookup order, effective date matching, zero-rate case
- [ ] `generateReceiptNumber()` — sequential, no collision, correct format
- [ ] Idempotency key enforcement — duplicate returns original, new key creates new record
- [ ] Posting rule validation — debit must equal credit per journal; journal with unbalanced entries is rejected
- [ ] Daily limit computation — sum of today's purchases + new amount vs limit
- [ ] Per-transaction limit — amount vs per_txn_limit

### Integration Tests
- [ ] Fund → balance updates correctly
- [ ] Fund (duplicate bank ref) → 409, no duplicate journal
- [ ] Purchase (remote send) → reservation posts → upstream success → final journal posts → receipt created
- [ ] Purchase (token generate) → same flow, token_value populated on receipt
- [ ] Purchase → upstream failure → reservation released → balance unchanged
- [ ] Purchase (insufficient balance) → 400 before reservation posts
- [ ] Purchase (daily limit exceeded) → 400 before reservation posts
- [ ] Reversal → compensating entries post → balance restored
- [ ] Commission accrual → correct zero amount in v1
- [ ] Reconciliation L1 → balance drift detected
- [ ] Reconciliation L2 → stuck reservation flagged after 15 minutes

### Restart / Hydration Tests
- [ ] Fund wallet → wipe in-memory store → `getWallet()` returns correct data from Supabase
- [ ] Create purchase order → wipe store → `getPurchaseOrder()` returns correct data
- [ ] Restart with stuck reservation → `rehydrateInFlightOrders()` flags it → exception created
- [ ] Cache miss → Supabase read → second call served from cache (verify single DB call)

### Concurrency Tests
- [ ] Two simultaneous purchases, balance sufficient for one → one succeeds, one gets 400 (no double-debit)
- [ ] Two simultaneous funding approvals for same request → one posts, one replays via idempotency
- [ ] Reconciliation run concurrent with purchase → consistent results, no phantom exceptions

### Security Tests
- [ ] Vendor user cannot read meters outside their site_code
- [ ] Vendor user cannot read another vendor's wallet or purchase orders
- [ ] Client cannot insert, update, or delete `ledger_entries`
- [ ] Client cannot delete `wallet_receipts` or `audit_logs`
- [ ] Rate limit test: 6th purchase attempt in 60 seconds returns 429
- [ ] Missing idempotency key on purchase returns 400
- [ ] Expired temp password returns 403 with `FORCE_PASSWORD_CHANGE`

### Performance Tests
- [ ] 50 concurrent purchases from funded wallet → all succeed, no errors, no duplicates
- [ ] 5 concurrent purchases against balance for 3 → exactly 3 succeed, 2 return 400
- [ ] Wallet summary endpoint → p99 < 300ms at 100 req/s
- [ ] Reconciliation on 10,000 orders → completes in under 2 minutes

---

## 19. Go-Live SOP

### Pre-Launch Checklist

**Infrastructure:**
- [ ] Supabase project provisioned for production (separate from staging)
- [ ] All 4 migrations applied to production Supabase
- [ ] Supabase service role key stored in environment variable only — never in code or documents
- [ ] Supabase Auth hook for custom JWT claims deployed and tested
- [ ] Storage bucket created with correct access policy (private, signed URLs)
- [ ] Environment variables verified: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `UPSTREAM_TOKEN_API_URL`, `UPSTREAM_TOKEN_API_KEY`

**Security:**
- [ ] All RLS policies verified against test matrix (minimum 20 test cases)
- [ ] HTTPS enforced with valid certificate
- [ ] CORS whitelist contains only production domain
- [ ] Rate limiting active and tested
- [ ] Audit log appends correctly in production environment

**Operational:**
- [ ] Finance team trained on funding approval flow
- [ ] Ops team trained on exception board and resolution workflow
- [ ] Admin trained on credential creation and vendor onboarding
- [ ] Support runbook distributed (see Section 20)
- [ ] Escalation contacts defined for critical exceptions

### Launch Sequence

1. Apply migrations to production Supabase
2. Seed platform ledger accounts (platform_cash_clearing, platform_sales_revenue, etc.)
3. Seed commission rule with `rate = 0.0000`
4. Enable wallet feature flag for internal users only
5. Create 1–2 pilot vendors for one site
6. Admin creates credentials, vendor completes onboarding, wallet funded manually (small test amount)
7. Run 5 test purchases: mix of remote send and token generate, on each delivery path
8. Verify reconciliation engine detects no exceptions
9. Verify EOD report produced correctly for test date
10. Shadow-reconcile against any existing manual finance records for the same site
11. Run for 5–10 clean business days with pilot vendors
12. Expand to all vendors on the pilot site
13. Validate reconciliation and settlement for the site
14. Expand to additional sites
15. Activate commission rules when business policy sets rate
16. Enable selective automation alerts

---

## 20. Operational Runbooks

### Runbook 1: Resolving a Stuck Purchase Reservation

**Trigger:** Exception type `purchase_stuck_reserved`, severity `high`.

**Steps:**
1. Open the exception in the exception board
2. Note the `purchase_order_id` from the exception detail
3. Navigate to the purchase order via the admin purchase detail page
4. Check the `upstream_transaction_id` field:
   - If empty: upstream call never completed. Release the reservation using "Release Reservation" action. No money moved. Vendor is unaffected.
   - If populated: upstream call completed. Verify with upstream platform whether delivery succeeded.
     - Upstream confirms delivery: finalise the purchase using "Finalise Purchase" action. Ledger posts, receipt generated.
     - Upstream confirms failure: release reservation. Vendor balance restored.
     - Upstream inconclusive: escalate to senior finance for manual investigation. Do not resolve the exception yet.
5. Resolve exception with coded resolution and note

### Runbook 2: Responding to a Balance Snapshot Drift (L1 Failure)

**Trigger:** Exception type `balance_snapshot_drift`, severity `critical`.

**Steps:**
1. This is a critical integrity failure. Immediately notify finance lead and system admin.
2. Freeze the affected wallet using the wallet freeze action. No new purchases until resolved.
3. Open the affected wallet's ledger view in the admin panel.
4. Compare the sum of all posted ledger entries for `vendor_float` and `vendor_reserved` against the snapshot values.
5. Identify the source of drift: a posting that succeeded in Supabase without updating the snapshot, or a snapshot update that fired without a corresponding journal.
6. If root cause is a missed snapshot update: re-trigger snapshot refresh via `POST /api/reconciliation/run` with `force_l1=true`.
7. Verify snapshot now matches ledger sum.
8. Unfreeze wallet (requires ops + finance approval).
9. Resolve exception with full documentation of root cause and corrective action.
10. If root cause cannot be determined: do not unfreeze; escalate to engineering.

### Runbook 3: Vendor Reports Token Not Working

**Steps:**
1. Ask vendor to provide receipt number.
2. Look up receipt in admin receipt detail page using receipt number.
3. Verify `token_value` on the receipt is the exact value given to the customer.
4. Check `wallet_purchase_orders` row: verify `status = 'successful'` and `upstream_transaction_id` is populated.
5. Verify with upstream platform that the token was generated correctly for the meter SN.
6. If token is valid but customer cannot enter it: this is a meter keypad issue, not a wallet issue. Direct to field team.
7. If token was never generated (upstream failure): open a reversal case from the purchase order detail page.
8. If duplicate token was issued (rare): escalate to upstream platform team.

### Runbook 4: Vendor Account Locked After Failed Logins

**Steps:**
1. Navigate to Admin → Users → search for vendor username.
2. Verify lockout status and timestamp.
3. Verify the vendor's identity (phone callback or email verification).
4. Click "Unlock Account" on the user detail page.
5. Advise vendor to reset password on next login.
6. Write a note on the vendor record explaining the unlock reason.
7. If 3 or more lockout events in 7 days: create an ops review task for potential credential sharing investigation.

### Runbook 5: Emergency Wallet Freeze

**Trigger:** Suspicious purchase pattern, fraud report, or AML flag.

**Steps:**
1. Navigate to Admin → Wallets → select the wallet.
2. Click "Freeze Wallet" — requires ops role minimum.
3. Enter freeze reason (select from list + mandatory note).
4. Confirm: all new purchases immediately blocked; existing reservations preserved.
5. Create a manual exception case in the exception board for the investigation.
6. Notify finance lead.
7. To unfreeze: requires ops + finance dual approval (maker-checker). Both approvers must review the investigation findings before approving.

---

## 21. What the Completed System Achieves

When all 7 phases are complete and the system is in production operation, the following is true:

### Financial Integrity
- Every naira that enters or leaves a vendor wallet is recorded as an immutable, double-entry accounting entry. There is no way to change a wallet balance without creating a traceable ledger record.
- The wallet survives any number of process restarts, server failures, or infrastructure events. Financial state lives in Supabase and is always recoverable.
- The system detects and flags any balance discrepancy within 10 minutes of occurrence. Finance is never surprised by a reconciliation difference at end of month.
- A locked daily report is produced for every business date for every site. Finance has a clean audit trail for every day of operation.

### Vendor Operations
- Vendors can fund their wallets via bank transfer with a clear, trackable reference system. Manual confirmation by finance takes minutes, not days.
- Vendors can purchase units and deliver them to customers by either remote send or token generation in a single, guided flow. They do not need to understand the technical difference.
- Every transaction produces a numbered, permanent receipt that can be printed or shared with the customer as proof of purchase.
- Vendors cannot transact outside their assigned site. A vendor in Site A has zero visibility into Site B's customers, meters, or transactions.
- Vendors see their exact available balance before every purchase. There are no surprises.

### Internal Operations
- Finance can approve funding requests, review reversals, and manage exceptions entirely from the UI without any direct database access.
- Ops can manage vendors, suspend accounts, and resolve operational exceptions from the exception board.
- The reconciliation engine runs automatically. Finance does not run manual spreadsheet reconciliation. The system is the reconciliation.
- The maker-checker system prevents any single person from making high-value financial changes unilaterally. Every large reversal, manual credit, or credit limit change requires two independent approvers.
- The audit trail records every action taken by every user with timestamps, IP addresses, and payload snapshots. There is no action that cannot be attributed.

### Security
- No vendor can self-register. Every account is created and scoped by an admin.
- Row-level security in the database means a compromised application bug cannot expose cross-vendor data. The security boundary is enforced at the database layer, not just in application code.
- Suspicious behaviour (rapid purchases, IP anomalies, repeated failed proofs) is detected automatically and triggers wallet suspension without waiting for a human to notice.
- Commission and financial rules cannot be changed unilaterally. Commission rate changes require finance role. Large-impact changes require maker-checker.

### Scale and Extensibility
- The commission engine is wired from day one. Activating a non-zero rate requires no code changes and no schema migration — only a configuration record update.
- The system supports multiple sites. Adding a new site requires a site record, not a new deployment.
- The credit facility is designed into the data model from the start. Activating credit for a vendor requires only a limit policy update, not a new feature build.
- The entire architecture fits inside the existing CRM3 codebase without breaking any existing routes, UI, or token generation flows. The wallet is additive, not a replacement.

---

*Document version: 2.0*
*System: ACOB CRM3 Vendor Wallet Vending Platform*
*Stack: React · Express/TypeScript · Supabase · Africa/Lagos (WAT)*
*This document constitutes the complete Standard Operating Procedure for implementation, operation, and maintenance of the Vendor Wallet system.*
