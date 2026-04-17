# ACOB Lighting Technology Limited — Vendor Wallet System
## Critical Critique, Corrected Flow & Complete Implementation Plan

> This document is retained for critique history. The canonical implementation standard for this repo is [ACOB_Vendor_Wallet_SOP_v2.md](C:\Users\ACOB\Desktop\VS Code\acob-crm3\docs\ACOB_Vendor_Wallet_SOP_v2.md), adapted to the existing React/Express/runtime-engine structure of ACOB CRM3.

---

> ⚠️ **SECURITY NOTICE — Action Required Immediately**
> The Supabase personal access token included in your message (`sbp_ee730118f44b767d06a2efb1f6a9f3c669cf0ddb`) is exposed. This token can be used to administer your entire Supabase account. **Revoke it immediately** at https://supabase.com/dashboard/account/tokens and generate a new one. Never include tokens in chat, documents, or version control.

---

## Part 1 — What the Original Flow Gets Right

The following design decisions in the original SOP are correct and must be preserved:

- Double-entry ledger as the single source of financial truth
- Reservation-before-upstream-call pattern to prevent debit without delivery
- Idempotency key requirement on all money-moving operations
- Reconciliation engine modelled on the existing runtime engine pattern
- Phased rollout with explicit exit criteria per phase
- Explicit commission accrual separated from purchase debit logic
- Immutable posted journal rows — no silent mutation

---

## Part 2 — Critical Gaps (8 Issues)

### Gap 1 — Credential Creation Sequencing is Broken

**Severity:** Critical

The brief states that admin creates login credentials before onboarding proceeds. However, the onboarding flow in the original Section 1 begins with "Ops creates vendor profile in draft state" as step 1, with no mention of credential creation as a prerequisite or trigger.

The result is a structural sequencing problem: a vendor cannot log in to complete onboarding if they have no credentials, but the flow treats credential creation as conceptually separate from the onboarding lifecycle without defining ordering, ownership, or the event that triggers it.

**Correction:** Phase 0 (admin credential creation) must be a hard prerequisite gate. No onboarding record should be created until a credential pair exists and has been issued to the vendor contact.

---

### Gap 2 — Vendor Portal Experience is Entirely Absent

**Severity:** Critical

The original spec describes backend flows in detail but never defines what the vendor sees after logging in. There is no login page spec, no dashboard layout, no navigation structure, and no description of the purchase UI or how a vendor chooses between remote send and token generation.

A vendor who receives credentials has no defined user journey. This is not a backend omission — it is a product gap that will cause the frontend build to stall immediately.

**Correction:** Vendor portal UI is specified in Part 5 of this document.

---

### Gap 3 — Dual Delivery Path Not Modelled at API or Data Level

**Severity:** Critical

The brief explicitly states vendors can choose between remote send and token generation. The original flow acknowledges this in the business context but never models it:

- The `wallet_purchase_orders` table has no `delivery_method` column
- The API spec shows a single `POST /api/wallet/purchase` endpoint with no branching
- There is no differentiation in upstream call, receipt format, stored fields, or failure mode

These two delivery paths call different upstream services, produce different outputs, have different receipt requirements, and have different failure modes. They cannot share an undifferentiated endpoint without significant rework.

**Correction:** Two distinct purchase endpoints sharing a common reservation/validation/ledger service, branching at the upstream call layer. See Part 3.

---

### Gap 4 — Receipt Specification is Missing

**Severity:** High

The brief explicitly requires receipts for both delivery methods. The original flow has no receipt data model, no field list, no format definition, and no delivery mechanism.

Open questions left unresolved by the original:
- Is the receipt displayed on screen, sent by SMS, or printable as PDF?
- What fields are required for remote send vs token generation?
- Is the receipt number sequential or UUID-based?
- Can a vendor retrieve a past receipt?

**Correction:** `wallet_receipts` table and receipt field specifications defined in Part 3.

---

### Gap 5 — Commission Engine Built Before Rate is Non-Zero

**Severity:** Medium

The business rule states commission is zero for now. The original flow builds a full commission accrual and settlement engine in Phase 5 before any rate is active. This wastes sprint capacity and introduces reconciliation noise from zero-value entries.

**Correction:** Provision the `vendor_commission_rules` table in Phase 0 with `commission_rate = 0.00` as the default. Commission accrual posts zero-amount entries from Phase 3 onward, confirming the wiring is correct before any rate activates. The settlement engine is wired in Phase 5 but runs against zero entries until business policy changes.

---

### Gap 6 — Site-Scoped Customer Visibility Not Translated to RLS

**Severity:** High

The brief states: "they have access to the customer details of the site ID they are in only." The original Supabase section says "vendor users can only read their own vendor rows" — which governs vendor data, not customer or meter data. The RLS policies governing which meters a vendor can query are absent.

Without this policy, a vendor user could query meters from any site, either by accident or deliberately.

**Correction:** Explicit RLS policy on the customers/meters table using site_code from the vendor_users join. See Part 4.

---

### Gap 7 — RBAC is Names-Only, No Permission Matrix

**Severity:** High

Seven roles are listed in the original: `super_admin`, `admin`, `finance`, `ops_manager`, `field_agent`, `vendor_manager`, `vendor_user`. But there is no permission matrix, no action-to-role mapping, no JWT claim structure, and no per-table per-role Supabase policy definition.

"Finance approves wallet activation" appears in prose but is never translated into a permission rule. Each developer implementing a feature will make independent access control decisions, producing inconsistent RBAC across the system.

**Correction:** Full RBAC matrix defined in Part 4. JWT claim structure and Supabase policy patterns specified.

---

### Gap 8 — Purchase Order Has No Delivery Method Column, Token Record Has No Channel Flag

**Severity:** High

The `wallet_purchase_orders` table in the original spec has no `delivery_method` column and no field distinguishing a remote-send result from a token-generation result. The `token_transaction_id` field exists but there is no corresponding `remote_send_ref` or channel indicator.

When auditing a purchase six months later, there is no way to determine from the database record alone whether funds were delivered by remote send or token generation. This breaks the receipt audit trail and makes exception bucket `local_success_upstream_missing` ambiguous — because the upstream call for remote send and token generation are different services with different response shapes.

**Correction:** `delivery_method`, `delivery_destination`, `token_value`, and `receipt_ref` columns added to `wallet_purchase_orders`. See Part 3.

---

## Part 3 — Corrected Data Model

### Additions to `wallet_purchase_orders`

```sql
ALTER TABLE wallet_purchase_orders ADD COLUMN
  delivery_method      text NOT NULL
    CHECK (delivery_method IN ('remote_send', 'token_generate'));

ALTER TABLE wallet_purchase_orders ADD COLUMN
  delivery_destination text;          -- meter_sn for remote_send, null for token_generate

ALTER TABLE wallet_purchase_orders ADD COLUMN
  token_value          text;          -- populated only for token_generate success

ALTER TABLE wallet_purchase_orders ADD COLUMN
  receipt_ref          uuid REFERENCES wallet_receipts(id);
```

### New Table: `wallet_receipts`

```sql
CREATE TABLE wallet_receipts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid        NOT NULL REFERENCES wallet_purchase_orders(id),
  vendor_id         uuid        NOT NULL REFERENCES vendor_organizations(id),
  site_code         text        NOT NULL,
  delivery_method   text        NOT NULL CHECK (delivery_method IN ('remote_send', 'token_generate')),
  meter_sn          text        NOT NULL,
  customer_ref      text,
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  token_value       text,          -- null for remote_send
  remote_send_ref   text,          -- null for token_generate
  issued_at         timestamptz NOT NULL DEFAULT now(),
  receipt_number    text        UNIQUE NOT NULL,  -- sequential, human-readable
  issued_by         uuid        NOT NULL,         -- vendor_user auth id
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Receipt number generation function
CREATE SEQUENCE receipt_number_seq START 100000 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text LANGUAGE sql AS $$
  SELECT 'RCP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('receipt_number_seq')::text, 6, '0');
$$;
```

### Receipt Fields by Delivery Method

**Remote Send Receipt:**
- Receipt number
- Date and time
- Vendor name and code
- Site name
- Meter serial number
- Customer name and account reference
- Amount sent (NGN)
- Delivery reference (upstream transaction ID)
- Status: Delivered

**Token Generation Receipt:**
- Receipt number
- Date and time
- Vendor name and code
- Site name
- Meter serial number
- Customer name and account reference
- Amount purchased (NGN)
- Token value (20-digit string, clearly displayed)
- Instructions for customer

### Corrected API Shape

Replace `POST /api/wallet/purchase` with:

```
POST /api/wallet/purchase/remote-send
POST /api/wallet/purchase/generate-token
GET  /api/wallet/receipt/:receiptId
GET  /api/wallet/receipt/:receiptId/print
```

Both endpoints share the same reservation, validation, balance check, and ledger posting logic through `wallet-purchase.ts`. They branch only at:

1. The upstream API call (different service, different payload, different response)
2. The receipt generation (different fields, different template)
3. The stored `delivery_method` and `token_value` / `remote_send_ref` values

### Request Bodies

**`POST /api/wallet/purchase/remote-send`**
```json
{
  "idempotency_key": "uuid",
  "wallet_id": "uuid",
  "meter_sn": "string",
  "customer_ref": "string",
  "amount": 5000.00,
  "site_code": "string"
}
```

**`POST /api/wallet/purchase/generate-token`**
```json
{
  "idempotency_key": "uuid",
  "wallet_id": "uuid",
  "meter_sn": "string",
  "customer_ref": "string",
  "amount": 5000.00,
  "site_code": "string"
}
```

---

## Part 4 — RBAC Matrix and RLS Policies

### JWT Claim Structure

Every authenticated session token must carry:

```json
{
  "sub": "auth_user_id",
  "role": "vendor_user",
  "site_code": "SITE_001",
  "vendor_id": "uuid",
  "app_role": "vendor_user"
}
```

For internal staff roles, `vendor_id` is null and `site_code` may be null (super_admin, finance) or site-specific (ops_manager, field_agent).

### Permission Matrix

| Action | super_admin | admin | finance | ops_manager | vendor_manager | vendor_user |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Create vendor credentials | ✓ | ✓ | — | — | — | — |
| Create vendor profile | ✓ | ✓ | — | — | — | — |
| Approve vendor onboarding | ✓ | ✓ | ✓ | — | — | — |
| Suspend / reactivate vendor | ✓ | ✓ | — | ✓ | — | — |
| View all vendors | ✓ | ✓ | ✓ | site-only | site-only | own only |
| Approve wallet funding | ✓ | ✓ | ✓ | — | — | — |
| View all wallets | ✓ | ✓ | ✓ | site-only | site-only | own only |
| Initiate funding request | — | — | — | — | — | ✓ |
| Upload funding proof | — | — | — | — | — | ✓ |
| Purchase (remote send) | — | — | — | — | — | ✓ |
| Purchase (generate token) | — | — | — | — | — | ✓ |
| View own receipts | — | — | — | — | — | ✓ |
| View all receipts | ✓ | ✓ | ✓ | site-only | site-only | — |
| Request reversal | — | — | — | — | — | ✓ |
| Approve reversal | ✓ | ✓ | ✓ | — | — | — |
| Post manual ledger adjustment | ✓ | — | ✓ | — | — | — |
| Run reconciliation | ✓ | ✓ | ✓ | — | — | — |
| View exception board | ✓ | ✓ | ✓ | ✓ | — | — |
| Resolve exceptions | ✓ | ✓ | ✓ | ✓ | — | — |
| Edit commission rules | ✓ | ✓ | ✓ | — | — | — |
| View finance dashboard | ✓ | ✓ | ✓ | — | — | — |
| Change vendor credit limit | ✓ | — | ✓ | — | — | — |
| View audit logs | ✓ | ✓ | ✓ | site-only | — | — |

### Supabase RLS Policies

```sql
-- ============================================================
-- vendor_wallets
-- ============================================================

-- Vendors see only their own wallet
CREATE POLICY "vendor_wallet_self_read" ON vendor_wallets
  FOR SELECT USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_users
      WHERE auth_user_id = auth.uid()
    )
    OR auth.jwt() ->> 'app_role' IN ('admin', 'super_admin', 'finance', 'ops_manager')
  );

-- Only service role can insert wallets (provisioning is server-side only)
CREATE POLICY "vendor_wallet_service_insert" ON vendor_wallets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- No direct updates from client
CREATE POLICY "vendor_wallet_no_client_update" ON vendor_wallets
  FOR UPDATE USING (auth.role() = 'service_role');


-- ============================================================
-- customers / meters (site-scoped)
-- ============================================================

-- Vendors see only customers in their assigned site
CREATE POLICY "customer_site_scope" ON customers
  FOR SELECT USING (
    site_code IN (
      SELECT vu.site_code FROM vendor_users vu
      WHERE vu.auth_user_id = auth.uid()
    )
    OR auth.jwt() ->> 'app_role' IN ('admin', 'super_admin', 'finance', 'ops_manager')
  );


-- ============================================================
-- ledger_entries (immutable, service-role only)
-- ============================================================

CREATE POLICY "ledger_entries_service_insert_only" ON ledger_entries
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "ledger_entries_no_update" ON ledger_entries
  FOR UPDATE USING (false);

CREATE POLICY "ledger_entries_no_delete" ON ledger_entries
  FOR DELETE USING (false);

-- Finance and admin can read all entries; vendors read own only
CREATE POLICY "ledger_entries_read_scoped" ON ledger_entries
  FOR SELECT USING (
    auth.jwt() ->> 'app_role' IN ('admin', 'super_admin', 'finance')
    OR journal_id IN (
      SELECT lj.id FROM ledger_journals lj
      WHERE lj.site_code = (
        SELECT vu.site_code FROM vendor_users vu WHERE vu.auth_user_id = auth.uid()
      )
    )
  );


-- ============================================================
-- wallet_purchase_orders
-- ============================================================

CREATE POLICY "purchase_orders_vendor_self" ON wallet_purchase_orders
  FOR SELECT USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_users WHERE auth_user_id = auth.uid()
    )
    OR auth.jwt() ->> 'app_role' IN ('admin', 'super_admin', 'finance', 'ops_manager')
  );

-- Vendors can insert their own purchase orders (backend validates further)
CREATE POLICY "purchase_orders_vendor_insert" ON wallet_purchase_orders
  FOR INSERT WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM vendor_users WHERE auth_user_id = auth.uid()
    )
    AND auth.jwt() ->> 'app_role' = 'vendor_user'
  );


-- ============================================================
-- wallet_funding_requests
-- ============================================================

CREATE POLICY "funding_requests_scoped_read" ON wallet_funding_requests
  FOR SELECT USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_users WHERE auth_user_id = auth.uid()
    )
    OR auth.jwt() ->> 'app_role' IN ('admin', 'super_admin', 'finance', 'ops_manager')
  );

CREATE POLICY "funding_requests_vendor_insert" ON wallet_funding_requests
  FOR INSERT WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM vendor_users WHERE auth_user_id = auth.uid()
    )
    AND auth.jwt() ->> 'app_role' = 'vendor_user'
  );


-- ============================================================
-- wallet_receipts
-- ============================================================

CREATE POLICY "receipts_vendor_self" ON wallet_receipts
  FOR SELECT USING (
    vendor_id IN (
      SELECT vendor_id FROM vendor_users WHERE auth_user_id = auth.uid()
    )
    OR auth.jwt() ->> 'app_role' IN ('admin', 'super_admin', 'finance', 'ops_manager')
  );

CREATE POLICY "receipts_service_insert" ON wallet_receipts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "receipts_no_update" ON wallet_receipts
  FOR UPDATE USING (false);

CREATE POLICY "receipts_no_delete" ON wallet_receipts
  FOR DELETE USING (false);
```

---

## Part 5 — Vendor Portal UI Specification

### Navigation Structure

```
/vendor/dashboard           -- home with balance and recent activity
/vendor/buy                 -- purchase flow (step 1 of 3)
/vendor/buy/confirm         -- purchase confirmation (step 2 of 3)
/vendor/buy/receipt/:id     -- receipt display (step 3 of 3)
/vendor/transactions        -- full transaction history with filters
/vendor/receipts            -- receipt archive
/vendor/topup               -- funding request initiation
/vendor/topup/:id           -- funding status tracker
/vendor/statement           -- wallet statement with date range
/vendor/profile             -- account details (read-only)
```

### Dashboard Screen

**Header row:** Vendor name, site badge, last login timestamp, logout.

**Three metric cards:**
- Available Balance (NGN) — live from snapshot
- Today's Purchases — count and total value
- Pending (reserved) — amount currently reserved in active orders

**Primary CTA:** "Buy Units" button — large, prominent.

**Secondary CTA:** "Request Top-Up" button.

**Recent Transactions table:** Last 10 transactions. Columns: date/time, type (fund / purchase / reversal), description (meter SN or funding ref), amount, balance after, receipt link. Each row is expandable to show full detail.

**Wallet status banner:** If wallet is frozen or vendor is suspended, show a full-width banner with the reason and a contact link.

---

### Purchase Flow — Step 1: Find Meter

**Search field:** Type meter serial number or customer name. Results are site-scoped by RLS — only meters belonging to the vendor's assigned site appear. No site selector is shown to the vendor (it is implicit).

**Result card shows:** Customer name, meter SN, meter type, account status, last vended date.

**Vendor selects a meter and proceeds.**

---

### Purchase Flow — Step 2: Choose Amount and Delivery Method

**Amount input:** Numeric field. Show available wallet balance beneath.

**Delivery method — two clearly distinct options presented as radio cards:**

**Option A — Send directly to meter**
- Description: "Units are sent electronically to the customer's meter. No token is needed."
- Best for: customers nearby or reachable remotely.

**Option B — Generate token**
- Description: "A token code is generated. Give the 20-digit code to the customer to enter on their meter."
- Best for: customers not reachable remotely or who prefer a physical token.

**Confirm button** shows: "Debit NGN X,XXX from wallet — proceed."

---

### Purchase Flow — Step 3: Receipt

Displayed immediately after successful upstream response.

**Remote Send Receipt layout:**
```
ACOB Lighting Technology Ltd
VENDING RECEIPT — REMOTE SEND

Receipt No:    RCP-20250414-000123
Date/Time:     14 Apr 2025, 09:42:17 WAT
Vendor:        [Vendor Name] ([Vendor Code])
Site:          [Site Name]

Meter SN:      [Meter Serial Number]
Customer:      [Customer Name]
Account Ref:   [Account Reference]

Amount Sent:   NGN 5,000.00
Delivery Ref:  [Upstream Transaction ID]
Status:        DELIVERED

[Print Receipt]  [New Purchase]
```

**Token Generation Receipt layout:**
```
ACOB Lighting Technology Ltd
VENDING RECEIPT — TOKEN

Receipt No:    RCP-20250414-000124
Date/Time:     14 Apr 2025, 09:45:03 WAT
Vendor:        [Vendor Name] ([Vendor Code])
Site:          [Site Name]

Meter SN:      [Meter Serial Number]
Customer:      [Customer Name]
Account Ref:   [Account Reference]

Amount:        NGN 5,000.00

TOKEN:
┌─────────────────────────┐
│  1234  5678  9012  3456 │
└─────────────────────────┘

Ask your customer to enter this 20-digit code on their meter keypad.

[Print Receipt]  [New Purchase]
```

Both receipts are printable and retrievable from `/vendor/receipts`.

---

### Top-Up (Funding Request) Screen

1. Enter amount
2. Select channel (bank transfer, cash at branch)
3. System generates a unique funding reference number — vendor copies this
4. Upload payment proof (image or PDF)
5. Status tracker: Initiated → Proof Uploaded → Under Review → Confirmed → Posted

---

### Statement Screen

Date range picker (default: current month).

Table columns: Date, Reference, Description, Debit, Credit, Balance After.

Types shown: Fund Credit, Purchase Debit, Reversal Credit, Commission Credit (when active).

Export to CSV button.

---

## Part 6 — Corrected Phase Plan

### Phase 0 — Foundation (Week 1–2)

**Deliverables:**
- Supabase migrations: all tables including `wallet_receipts`, `delivery_method` columns, `commission_rules` with `rate = 0.00` seed
- JWT claim structure: `app_role`, `site_code`, `vendor_id` in all tokens
- All RLS policies as defined in Part 4
- RBAC middleware for Express (role + site_code claim validation)
- Admin credential creation UI: username, temp password, role assignment, site assignment
- Audit log integration for all credential creation events

**Exit criteria:**
- Admin can create a vendor_user credential scoped to a site
- RLS verified: vendor_user cannot read customers outside their site_code
- Ledger entries table verified: client cannot insert, update, or delete
- Commission rule seed exists with rate = 0.00

---

### Phase 1 — Onboarding + Wallet Provisioning (Week 3–4)

**Deliverables:**
- Vendor first-login flow with forced password change
- Onboarding form: business details, contact persons, KYC documents upload, bank account
- Vendor profile status machine: draft → pending_review → approved → active
- Finance approval queue UI
- Wallet auto-provisioning trigger on approval: creates wallet master, ledger accounts, limit policy row, commission profile row
- Vendor portal shell: navigation, dashboard skeleton, balance card (shows zero)

**Exit criteria:**
- Vendor created by admin, logs in, completes onboarding, finance approves
- Wallet provisioned automatically on approval
- Vendor dashboard loads with zero balance
- Vendor cannot access purchase screen until status is active

---

### Phase 2 — Funding (Week 5–6)

**Deliverables:**
- Funding initiation UI (vendor-facing): amount, channel, reference display
- Proof upload
- Finance approval screen with funding request queue
- Ledger posting service: debit platform_cash_clearing, credit vendor_float
- Balance snapshot updater
- Wallet balance card shows live funded balance
- Funding history list on vendor dashboard and admin view
- Duplicate bank reference blocked by unique constraint

**Exit criteria:**
- Approved funding posts correctly to ledger
- Vendor balance updates immediately after posting
- Duplicate reference rejected
- Statement and balance reconcile after funding

---

### Phase 3 — Purchase + Dual Delivery (Week 7–9)

**Deliverables:**
- Site-scoped meter/customer search (RLS-enforced — no site selector shown to vendor)
- Balance check and reservation logic
- `POST /api/wallet/purchase/remote-send` — upstream call, receipt generation, ledger finalisation
- `POST /api/wallet/purchase/generate-token` — upstream call, receipt generation, ledger finalisation
- `GET /api/wallet/receipt/:id` and printable receipt view
- Failed purchase: reservation release flow, reason code storage
- Purchase history list on vendor dashboard
- Commission accrual posts zero-amount entry on every successful purchase (wiring confirmed)

**Exit criteria:**
- Successful remote-send debits wallet once and produces correct receipt
- Successful token-generate debits wallet once and produces correct receipt with token value
- Failed purchase releases reservation automatically within one reconciliation cycle
- Upstream transaction reference stored on every purchase
- Vendor cannot query meters outside their site_code (verified by test)
- Commission entry created on every purchase with amount = 0.00

---

### Phase 4 — Reconciliation + Exceptions (Week 10–11)

**Deliverables:**
- `wallet-reconciliation-engine`: intraday (every 5–15 min) and end-of-day runs
  - L1: ledger vs balance snapshot
  - L2: purchase orders vs upstream token records
  - L3: funding requests vs confirmation records
- Exception tables with severity (low / medium / high / critical) and SLA timestamps
- Exception board UI: filterable by site, severity, type, assignee
- Exception resolution flow: coded action, compensating entries if required, audit log
- Daily reconciliation report

**Exit criteria:**
- Deliberate stuck reservation detected within 15 minutes by intraday engine
- `upstream_success_local_fail` exception created for an injected test case
- Finance can view, assign, and resolve an exception end-to-end
- Daily report produced and locked for a closed business date

---

### Phase 5 — Commission + Settlement (Week 12–13)

**Deliverables:**
- Commission rule engine: percentage + optional vendor override
- Accrual posting: debit platform_commission_expense, credit vendor_commission_payable
- Settlement engine: daily batch, posts commission credit to vendor_float when rate > 0
- Finance dashboard: total vendor float, total reserved, total unsettled commission, top vendors by volume, wallets near exhaustion, failed purchase count, reversal rate
- Commission statement on vendor dashboard (shows zero until rate activates)

**Exit criteria:**
- Commission accrual matches purchase output at correct rate
- Settlement batch posts and reports correctly for a non-zero test rate
- Zero entries from Phase 3 onward reconcile cleanly when rate is changed
- Finance dashboard KPIs load correctly

---

### Phase 6 — Hardening (Week 14–15)

**Deliverables:**
- Maker-checker workflow: large reversals, manual credits, credit limit changes require two approvers
- Auto-suspend triggers: repeated failed funding proofs (3 strikes), excessive reversal rate, KYC expiry, rapid-fire purchases above threshold
- IP and device fingerprint logging on all vendor purchase actions
- Per-vendor rate limiting
- Suspension and reactivation flow with reason logging and notification
- Load testing: concurrent purchase attempts against shared low balance (race condition verification)
- Retry + idempotency stress test: duplicate webhook delivery, backend crash mid-purchase
- Observability: exception escalation alerts, wallet-near-exhaustion alerts to finance

**Exit criteria:**
- No duplicate financial posting under retry with same idempotency key
- Auto-suspend fires on 3 consecutive failed funding proofs
- Maker-checker blocks large reversal without second approver
- Concurrent purchase test confirms no double-debit
- Admin team can operate exception queue safely without direct database access

---

## Part 7 — Backend Service File Structure

```
backend/src/
  api/
    vendor.ts           -- vendor CRUD, approval, suspension, invitation
    wallet.ts           -- funding, purchase (both branches), reversal, limits, statement
    reconciliation.ts   -- manual run trigger, exception list, exception resolve

  services/
    wallet-ledger.ts         -- double-entry posting, journal creation, balance snapshot
    wallet-funding.ts        -- funding request lifecycle, proof upload, approval
    wallet-purchase.ts       -- shared reservation/validation/finalisation logic
    wallet-purchase-remote.ts  -- remote-send upstream call + receipt
    wallet-purchase-token.ts   -- token-generate upstream call + receipt
    wallet-commission.ts     -- commission rule lookup, accrual posting
    wallet-reconciliation.ts -- L1-L5 reconciliation logic
    wallet-settlement.ts     -- daily settlement batch
    wallet-receipt.ts        -- receipt generation, number sequencing, retrieval
    vendor-wallet-risk.ts    -- limit checks, suspension triggers, risk rating

  engines/
    wallet-reconciliation-engine.ts  -- intraday + EOD scheduled jobs
    wallet-settlement-engine.ts      -- daily commission and settlement batch
    wallet-exception-monitor.ts      -- escalation + notification for unresolved cases
```

---

## Part 8 — Go-Live Readiness Checklist

In addition to the original SOP go-live steps, the following gates must be verified before expanding to any site:

### Credential and Access
- [ ] Admin credential creation flow tested end-to-end: create user, assign role, assign site, send credentials
- [ ] Forced password change confirmed on first vendor login
- [ ] Vendor cannot log in without admin-issued credentials
- [ ] Vendor cannot access purchase screen while status is not `active`

### Site Scoping
- [ ] RLS verified: vendor_user cannot query meters outside their assigned site_code
- [ ] RLS verified: vendor_user cannot view funding requests from other vendors
- [ ] RLS verified: vendor_user cannot view ledger entries from other vendors

### Purchase and Receipts
- [ ] Remote-send path produces correct receipt with upstream delivery reference
- [ ] Token-generate path produces correct receipt with token value displayed
- [ ] Receipt numbers are globally unique and human-readable
- [ ] Past receipts are retrievable from `/vendor/receipts`
- [ ] Failed purchase releases reservation within one reconciliation cycle (15 min max)
- [ ] Duplicate idempotency key blocked on both purchase endpoints

### Ledger Integrity
- [ ] No client-side insert, update, or delete possible on ledger_entries
- [ ] Derived balance from ledger entries matches wallet snapshot after 10 funded purchases
- [ ] Commission entries posted on every successful purchase (zero amount confirmed)

### Reconciliation
- [ ] Intraday engine detects a deliberate injected stuck reservation within 15 minutes
- [ ] `upstream_success_local_fail` exception created and surfaced for test case
- [ ] Daily report produced and locked for a closed business date

### Operations
- [ ] Finance can see the exception board and resolve a test case end-to-end without database access
- [ ] Auto-suspend fires on 3 consecutive failed funding proofs
- [ ] At least one maker-checker flow verified: reversal above threshold blocked for single approver
- [ ] Pilot: 5–10 clean business days on a single site before expanding

---

## Part 9 — Designs to Avoid (Original List Preserved + Additions)

### Original bad designs (from SOP — keep avoiding)
1. Single mutable balance column — race conditions, no auditability
2. Token transaction table used as wallet ledger — mixes sales events with accounting
3. Manual finance edits in the database — destroys audit trail
4. Instant commission credit in the same debit path — mixes commercial and accounting logic
5. Overdraft without controls from day one — rapid exposure growth

### Additional bad designs identified in critique
6. **Single purchase endpoint for both delivery methods** — produces ambiguous records, breaks receipt audit trail, and makes exception handling unreliable
7. **Building the full commission engine before the rate is non-zero** — wastes sprint capacity, introduces zero-value reconciliation noise, and creates unnecessary complexity before it is needed
8. **Omitting the vendor portal from the spec** — causes frontend stall on Day 1 of build and results in inconsistent UX decisions made independently by each developer
9. **Vague RLS language without explicit policies** — "vendor sees their own rows" is not a policy; it is a sentence. Every policy must be written in SQL before the sprint begins
10. **Credential creation without a defined trigger** — if admin creates credentials and vendor profile independently with no enforced sequencing, both workflows will drift and produce orphaned records

---

*Document version: 1.0 — based on ACOB CRM3 Vendor Wallet SOP and business brief*
*Stack: React · Express/TypeScript · Supabase · Africa/Lagos timezone*
