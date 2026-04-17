# Vendor Wallet System SOP

## Purpose

This document defines the end-to-end implementation flow for a vendor wallet system inside ACOB CRM3. The wallet behaves like a controlled bank account for vendors/resellers who buy prepaid units for retailing. It is designed for an already working system and fits the current stack:

- React frontend
- Express/TypeScript backend
- Supabase as the durable app-native database
- Existing upstream meter/token platform for token generation and legacy operational data
- Existing runtime engine pattern for asynchronous jobs and reconciliation

This is not a generic fintech brainstorm. It is the recommended operating model for this repo based on the current architecture in:

- [ARCHITECTURE.md](C:\Users\ACOB\Desktop\VS Code\acob-crm3\ARCHITECTURE.md)
- [backend/src/api/token.ts](C:\Users\ACOB\Desktop\VS Code\acob-crm3\backend\src\api\token.ts)
- [backend/src/services/supabase-db.ts](C:\Users\ACOB\Desktop\VS Code\acob-crm3\backend\src\services\supabase-db.ts)
- [backend/src/services/priority-engines.ts](C:\Users\ACOB\Desktop\VS Code\acob-crm3\backend\src\services\priority-engines.ts)
- [supabase/README.md](C:\Users\ACOB\Desktop\VS Code\acob-crm3\supabase\README.md)

## Executive Decision

The wallet must be implemented as a double-entry ledger with derived balances, not as a mutable `balance` field that gets incremented and decremented directly.

That means:

- every financial movement is stored as an immutable ledger entry
- wallet balance is the sum of posted entries
- token purchases reserve and then consume funds atomically
- reversals happen through compensating entries, never silent edits
- approvals, limits, and settlement are operational layers around the ledger

This is the correct SOP for a production vendor-float system.

## Business Context

The vendor wallet is for approved vendors who pre-fund money and use that float to buy units/tokens for resale to customers.

The system must support:

- vendor onboarding and KYC review
- wallet funding
- wallet debit when buying units
- commission handling
- credit/overdraft policy where allowed
- reversal/refund handling
- daily reconciliation
- suspense and exception handling
- finance approvals
- site-scoped operations
- full auditability

## Core Principles

1. Ledger first
Every money movement must create immutable accounting entries.

2. No silent mutation
Never overwrite balances, transactions, or approvals after posting.

3. Idempotent commands
Every external-facing financial command must accept an idempotency key.

4. Money and token generation must be linked
A vendor debit without a token record is an exception. A token record without a wallet debit is also an exception.

5. Clear status transitions
Use explicit lifecycle states for funding, purchase, reversal, payout, and suspension.

6. Human approval only where risk justifies it
Normal vendor purchases should be automatic. Only high-risk actions go into manual approval.

7. Reconciliation is a system feature, not a manual spreadsheet habit
Nightly and intraday reconciliation jobs must be first-class runtime engines.

## Operating Model

### Actors

- `super_admin`: global control
- `admin`: system administration
- `finance`: wallet funding approval, reconciliation, reversals, settlement
- `ops_manager`: vendor management, suspension, operational controls
- `field_agent`: may onboard vendors or collect documents if needed
- `vendor_manager`: new role to add for vendor operations
- `vendor_user`: portal/API consumer for wallet usage

### Main entities

- vendor organization
- vendor users
- vendor wallet
- wallet ledger account set
- funding request
- funding receipt/payment proof
- purchase order
- token issuance link
- commission rule
- reversal case
- reconciliation batch
- settlement batch
- risk/limit policy

### Scope model

The wallet should be site-scoped first, with optional multi-site expansion later.

Recommended v1 rule:

- one vendor can belong to one primary site
- one operational wallet per vendor per currency
- optional separate reserve account per vendor

## End-to-End Flow

## 1. Vendor Onboarding Flow

### Input

- business name
- contact persons
- phone/email
- government/company registration data
- address
- site assignment
- bank account details
- KYC documents
- proposed credit policy

### System flow

1. Ops creates vendor profile in draft state.
2. Documents are uploaded into `public.documents`.
3. Compliance/finance reviews the profile.
4. System creates vendor risk rating and operating limits.
5. Finance approves wallet activation.
6. System creates default wallet account set.
7. Vendor receives access invitation.

### States

- `draft`
- `pending_review`
- `approved`
- `active`
- `suspended`
- `closed`
- `rejected`

### Controls

- no wallet funding until vendor is `active`
- no token purchase when vendor is `suspended` or `closed`
- site scope must match the assigned operator scope

## 2. Wallet Provisioning Flow

When vendor becomes active, the system creates:

- wallet master record
- ledger accounts
- current balance snapshot row
- limit policy row
- commission profile row

### Required accounts per wallet

- `vendor_cash` or `vendor_float`
- `vendor_reserved`
- `vendor_commission_payable`
- `vendor_adjustment`
- `vendor_credit_limit` if credit is enabled
- `platform_cash_clearing`
- `platform_sales_revenue`
- `platform_commission_expense`
- `platform_suspense`

### Rule

The displayed wallet balance is computed from posted ledger entries plus a cached snapshot for fast reads.

## 3. Funding Flow

Funding is money moving into the vendor wallet before unit purchase.

### Supported funding channels

- bank transfer
- cash at branch with supervisor confirmation
- payment gateway webhook
- internal transfer from central distributor

### SOP

1. Vendor initiates funding request with amount and channel.
2. System generates a funding reference.
3. Vendor uploads payment proof if the channel is not fully automated.
4. If gateway/webhook confirms automatically, request moves to `confirmed`.
5. If manual confirmation is needed, finance reviews and approves.
6. System posts ledger entries:
   - debit `platform_cash_clearing`
   - credit `vendor_float`
7. Wallet snapshot updates.
8. Audit log and notification are created.

### Funding statuses

- `initiated`
- `awaiting_proof`
- `under_review`
- `confirmed`
- `posted`
- `rejected`
- `expired`
- `cancelled`

### Failure handling

- proof mismatch goes to exception queue
- duplicate bank reference is blocked by unique constraint
- if confirmation succeeded but posting failed, retry job posts using the same idempotency key

## 4. Purchase Flow For Units/Tokens

This is the most important flow.

### Pre-checks

- vendor is active
- wallet is not frozen
- available balance is enough
- daily purchase limit not exceeded
- per-transaction limit not exceeded
- site permission valid
- meter/customer is eligible

### Purchase SOP

1. Vendor submits purchase request:
   - meter number
   - customer or account reference
   - amount
   - site
   - channel/app source
   - idempotency key
2. System validates vendor, wallet, meter, site, and limits.
3. System calculates charges:
   - face value
   - fees
   - commission
   - net debit
4. System creates a `purchase_order` in `pending`.
5. System posts reservation ledger:
   - debit `vendor_reserved`
   - credit `vendor_float`
   Note:
   Internally this means available balance reduces immediately while final posting is still pending.
6. System calls upstream token generation endpoint through the existing backend token route pattern.
7. If upstream succeeds:
   - purchase becomes `successful`
   - final sale ledger posts
   - reservation is released/consumed
   - token issuance record is linked
   - commission accrual posts
8. If upstream fails:
   - reservation is reversed
   - purchase becomes `failed`
   - reason code is stored
9. Receipt is returned to vendor.
10. Notification and audit records are created.

### Recommended accounting shape

At request reservation:

- debit `vendor_reserved`
- credit `vendor_float`

At successful completion:

- debit `platform_cash_clearing`
- credit `vendor_reserved`
- debit `platform_commission_expense`
- credit `vendor_commission_payable`
- credit `platform_sales_revenue`

Important:
The exact final accounting mapping depends on whether the vendor buys at discount and sells at list price, or buys at list price and receives a later commission. For this project, the cleaner v1 is:

- debit vendor on gross purchase amount
- accrue vendor commission separately
- settle commission into wallet later or instantly based on business policy

That keeps reconciliation simpler.

### Purchase statuses

- `pending`
- `reserved`
- `processing`
- `successful`
- `failed`
- `reversed`
- `manual_review`

### Non-negotiable controls

- never call upstream first and debit later
- never debit wallet finally without storing upstream response reference
- every purchase must have one and only one financial outcome:
  - success
  - fail with released reservation
  - reversal with compensating entries

## 5. Commission Flow

Do not hide commission logic inside the purchase amount. Make it explicit.

### Supported commission models

- flat per purchase
- percentage of face value
- tiered by volume
- site-specific commission
- vendor-specific override

### Best v1 choice

Use percentage plus optional override:

- default commission per site/product
- optional vendor-specific override

### Commission SOP

1. On successful purchase, commission is calculated from rule snapshot.
2. System posts commission accrual:
   - debit `platform_commission_expense`
   - credit `vendor_commission_payable`
3. Settlement rule determines:
   - instant credit to wallet, or
   - daily settlement into wallet, or
   - bank payout

### Best operational choice

For this system, daily settlement into wallet is best in v1.

Why:

- easier reconciliation
- lower fraud risk
- easier finance approval
- clear cutoff per business day

## 6. Reversal And Refund Flow

This is where most bad wallet systems break.

### Allowed reversal triggers

- token generation failed after reservation
- duplicate purchase
- upstream success but token unreadable or corrupt with confirmed customer impact
- manual finance-approved refund

### SOP

1. Reversal case is opened against a successful or ambiguous purchase.
2. System verifies whether the token was actually issued and used.
3. If reversal is approved:
   - create compensating ledger entries
   - mark purchase as `reversed` or `partially_reversed`
   - create audit trail with approver
4. If customer already received valid units, reversal must be blocked unless there is a separate commercial adjustment workflow.

### Reversal controls

- maker-checker approval for finance reversals above threshold
- no direct delete/update of transaction
- every reversal references the original purchase id
- partial reversals allowed only if policy explicitly enables them

## 7. Credit / Overdraft Flow

This should be optional, not default.

### Recommendation

Do not launch with unsecured overdraft in v1 unless the business already operates it manually today.

If required:

- approve credit limit per vendor
- track utilized credit separately from float
- auto-block when credit limit exceeded
- daily delinquency monitoring

### Available balance formula

`available_balance = posted_float - reserved_amount + approved_credit_limit - credit_utilized - holds`

### Credit status

- `disabled`
- `active`
- `frozen`
- `delinquent`
- `expired`

## 8. Settlement Flow

Settlement covers commission settlement, central top-up settlement, and any bank payout.

### Daily settlement SOP

1. End-of-day batch closes business date by site.
2. System aggregates:
   - opening balance
   - total funding
   - total reserved
   - successful purchases
   - failed purchases
   - reversals
   - accrued commission
   - settled commission
   - closing balance
3. Finance reviews exceptions.
4. System posts approved settlement entries.
5. Reconciliation report is locked for that business date.

### Recommended rule

Use business date per site timezone, not UTC-only reporting.

This repo already uses Africa/Lagos for current site modeling, so keep that consistent.

## 9. Reconciliation Flow

This must be implemented exactly like the current runtime engine pattern used elsewhere in the backend.

### Reconciliation levels

- `L1`: wallet ledger vs wallet balance snapshot
- `L2`: purchase orders vs upstream token generation records
- `L3`: funding requests vs bank/gateway confirmations
- `L4`: commission accrual vs settlement
- `L5`: site/day operational summary vs finance control totals

### Intraday reconciliation

Runs every 5 to 15 minutes:

- detect stuck reservations
- detect successful upstream token with missing final posting
- detect posted debit with missing purchase result
- detect duplicate idempotency keys

### End-of-day reconciliation

Runs after business cutoff:

- close the business date
- produce finance-ready report
- push unresolved mismatches into exception queue

### Exception buckets

- `funding_unmatched`
- `purchase_stuck_reserved`
- `upstream_success_local_fail`
- `local_success_upstream_missing`
- `commission_mismatch`
- `duplicate_payment_reference`
- `manual_review_required`

## 10. Exception Management Flow

Every exception needs ownership and SLA.

### SOP

1. Detection engine creates exception case.
2. Case is assigned by site and severity.
3. Finance or ops resolves with coded action.
4. Resolution creates audit log and optional compensating entries.
5. Case closes only after reconciliation state is clean.

### Severity

- `low`
- `medium`
- `high`
- `critical`

### Example SLAs

- critical: 15 minutes
- high: 1 hour
- medium: same business day
- low: 2 business days

## 11. Suspension And Risk Control Flow

### Auto-suspend triggers

- repeated failed funding proofs
- excessive reversal rate
- device or IP anomaly
- rapid-fire purchases above configured threshold
- KYC expiry
- AML/manual watchlist flag

### Suspension effects

- block new purchases
- optionally allow view-only access
- preserve withdrawal/settlement controls for finance only

### Reactivation

- manual ops/finance approval
- reason logged
- notification sent

## 12. Reporting Flow

The wallet module must expose these views from day one:

- vendor balances
- vendor statement
- funding history
- purchase history
- reversal history
- commission accrual and settlement
- daily reconciliation summary
- exception queue
- aged credit exposure

### Dashboard KPIs

- total vendor float
- total reserved amount
- total unsettled commission
- total purchases today
- failed purchase count
- reversal rate
- top vendors by volume
- wallets near exhaustion

## Data Model

## New Supabase tables to add

### Master tables

- `vendor_organizations`
- `vendor_users`
- `vendor_wallets`
- `vendor_wallet_limits`
- `vendor_commission_rules`
- `vendor_bank_accounts`

### Transaction tables

- `wallet_funding_requests`
- `wallet_purchase_orders`
- `wallet_reversal_cases`
- `wallet_settlement_batches`
- `wallet_reconciliation_runs`
- `wallet_exceptions`

### Ledger tables

- `ledger_accounts`
- `ledger_journals`
- `ledger_entries`
- `wallet_balance_snapshots`

### Suggested minimal columns

`vendor_organizations`

- `id`
- `vendor_code`
- `legal_name`
- `display_name`
- `status`
- `site_code`
- `kyc_status`
- `risk_rating`
- `metadata`
- `created_at`
- `updated_at`

`vendor_wallets`

- `id`
- `vendor_id`
- `wallet_number`
- `currency_code`
- `status`
- `allow_credit`
- `created_at`
- `updated_at`

`wallet_purchase_orders`

- `id`
- `vendor_id`
- `wallet_id`
- `site_code`
- `meter_sn`
- `customer_id`
- `amount`
- `fee_amount`
- `commission_amount`
- `net_debit_amount`
- `status`
- `idempotency_key`
- `upstream_request_ref`
- `upstream_transaction_id`
- `token_transaction_id`
- `request_payload`
- `response_payload`
- `requested_by`
- `created_at`
- `updated_at`

`ledger_journals`

- `id`
- `journal_type`
- `source_type`
- `source_id`
- `site_code`
- `business_date`
- `status`
- `idempotency_key`
- `posted_at`
- `created_by`
- `created_at`

`ledger_entries`

- `id`
- `journal_id`
- `account_id`
- `entry_side`
- `amount`
- `currency_code`
- `reference_type`
- `reference_id`
- `metadata`
- `created_at`

### Constraints

- unique on vendor code
- unique on wallet number
- unique on idempotency key per operation type
- unique on external funding reference
- unique on upstream transaction id where applicable
- check constraints on positive amounts
- immutable posted journal rows

## How This Fits The Existing Repo

## Backend

Create new backend route groups:

- `backend/src/api/vendor.ts`
- `backend/src/api/wallet.ts`
- `backend/src/api/reconciliation.ts`

Create service modules:

- `backend/src/services/wallet-ledger.ts`
- `backend/src/services/wallet-funding.ts`
- `backend/src/services/wallet-purchase.ts`
- `backend/src/services/wallet-commission.ts`
- `backend/src/services/wallet-reconciliation.ts`
- `backend/src/services/vendor-wallet-risk.ts`

### Pattern to follow

- use the current Express router structure
- use `sendEnvelope`
- use `supabase-db.ts` style service-role access
- use admin/runtime-engine pattern for scheduled reconciliation
- use `audit_logs` for all sensitive actions

## Frontend

Add page catalog sections for:

- Vendor Management
- Wallet Overview
- Funding Requests
- Purchase Monitor
- Reconciliation
- Exceptions
- Settlement

### Vendor portal views

- balance card
- available balance
- pending reservations
- purchase form
- statement list
- funding upload
- commission summary

### Internal operations views

- approval queues
- daily reconciliation monitor
- exception case board
- vendor risk and limits page

## Supabase

Add migrations for the new tables and RLS.

### RLS model

- finance/admin can read all wallet rows
- site-scoped ops can read assigned site rows
- vendor users can only read their own vendor rows
- only backend service role can post ledger entries

## APIs

## Vendor APIs

- `POST /api/vendor/create`
- `POST /api/vendor/update`
- `POST /api/vendor/approve`
- `POST /api/vendor/suspend`
- `POST /api/vendor/invite-user`
- `POST /api/vendor/list`

## Wallet APIs

- `GET /api/wallet/:walletId/summary`
- `GET /api/wallet/:walletId/statement`
- `POST /api/wallet/funding/initiate`
- `POST /api/wallet/funding/approve`
- `POST /api/wallet/purchase`
- `POST /api/wallet/reversal/request`
- `POST /api/wallet/reversal/approve`
- `GET /api/wallet/limits`
- `POST /api/wallet/limits/update`

## Reconciliation APIs

- `GET /api/reconciliation/summary`
- `GET /api/reconciliation/exceptions`
- `POST /api/reconciliation/run`
- `POST /api/reconciliation/resolve-exception`

## Runtime Engines To Add

Use the same scheduler leadership pattern already present in runtime services.

### New engines

- `wallet-reconciliation-engine`
- `wallet-settlement-engine`
- `wallet-exception-monitor`

### Engine responsibilities

`wallet-reconciliation-engine`

- checks reservations older than threshold
- checks purchase/upstream mismatches
- checks funding/posting mismatches
- updates exception tables

`wallet-settlement-engine`

- computes daily commission settlement
- updates vendor wallet if settlement policy is wallet-credit
- closes business day summaries

`wallet-exception-monitor`

- escalates unresolved critical exceptions
- emits notifications to finance/admin

## Security And Controls

### Required controls

- idempotency keys for all money-moving POST operations
- maker-checker for large reversals, manual credits, credit limit changes
- audit log for all approvals and postings
- IP/device fingerprint logging for vendor actions
- request signing or secure session validation for vendor portal
- per-vendor rate limits
- per-site transaction thresholds
- frozen wallet flag
- immutable posted journals

### Approval thresholds

Recommended starter rules:

- vendor funding approval required for manual proof channels
- reversal above threshold requires finance + admin
- credit limit change requires finance + admin
- wallet adjustment always requires maker-checker

## Critique Of Bad Designs To Avoid

### Bad design 1: single balance column only

Why it fails:

- race conditions
- no proper auditability
- hard reconciliation
- impossible clean reversals

### Bad design 2: using token transaction table as wallet ledger

Why it fails:

- token transactions are sales events, not accounting truth
- funding, commission, and reversals do not fit cleanly there

### Bad design 3: manual finance edits in database

Why it fails:

- destroys audit trail
- causes unreconcilable balances
- creates insider risk

### Bad design 4: instant commission credit in the same debit path without separate accrual

Why it fails:

- difficult to reconcile
- difficult to restate if commission rule changes
- mixes commercial logic with accounting logic

### Bad design 5: supporting overdraft from day one without strong controls

Why it fails:

- rapid exposure growth
- hard collections
- operational abuse

## Final Recommended v1 Design

This is the best practical version for this project.

### Include in v1

- vendor onboarding
- site-scoped vendor wallets
- immutable ledger
- funding requests with manual and automated confirmation
- purchase reservation before upstream token call
- successful purchase finalization
- explicit commission accrual
- manual and policy-based reversal flow
- reconciliation engine
- exception queue
- daily settlement batch
- wallet statements and finance reports

### Exclude from v1

- complex multi-currency support
- unsecured dynamic overdraft
- peer-to-peer wallet transfers
- vendor cash withdrawal to bank on demand
- complicated promotional pricing engine

### Why this is the best output

- fits current backend and Supabase architecture
- keeps upstream token generation in place
- introduces durable app-native financial control
- minimizes fraud and reconciliation risk
- supports phased rollout without breaking existing token flows

## Phased Implementation Plan

## Phase 1: Schema And Core Services

### Deliverables

- Supabase migrations for vendor, wallet, ledger, funding, purchase, reconciliation tables
- backend wallet service modules
- audit integration
- role additions

### Exit criteria

- vendor can be created
- wallet can be provisioned
- test journal can post
- derived balance matches ledger entries

## Phase 2: Funding And Statements

### Deliverables

- funding request APIs
- proof upload
- finance approval screen
- wallet statement page
- balance snapshot updater

### Exit criteria

- approved funding posts correctly
- duplicate references blocked
- statement and balance reconcile

## Phase 3: Purchase Integration

### Deliverables

- purchase reservation flow
- upstream token generation linkage
- final posting flow
- failure release flow
- vendor purchase UI

### Exit criteria

- successful purchase debits wallet once
- failed purchase releases reservation automatically
- upstream reference stored on every purchase

## Phase 4: Reconciliation And Exceptions

### Deliverables

- reconciliation engine
- exception tables and UI
- daily control reports

### Exit criteria

- stuck transactions detected
- mismatch cases visible and assignable
- daily reconciliation report produced

## Phase 5: Commission And Settlement

### Deliverables

- commission rules
- accrual posting
- settlement batch
- finance dashboards

### Exit criteria

- commission accrual matches purchase output
- settlement batch can post and report correctly

## Phase 6: Hardening

### Deliverables

- maker-checker workflow
- risk triggers
- suspension automation
- load testing
- failure retry logic
- observability dashboards

### Exit criteria

- controlled recovery from partial failures
- no duplicate financial posting under retries
- admin team can operate exceptions safely

## Testing Strategy

### Unit tests

- balance calculation
- commission calculation
- limit validation
- idempotency enforcement
- posting rules

### Integration tests

- funding approval to ledger posting
- purchase reserve to upstream success to final journal
- purchase reserve to upstream failure to release
- reversal posting
- reconciliation mismatch detection

### Contract tests

- backend response envelopes
- frontend wallet pages against expected API shapes

### Operational tests

- retry after backend crash during purchase
- duplicate webhook delivery
- concurrent purchase attempts against low balance

## Go-Live SOP

1. Migrate schema.
2. Seed roles and permissions.
3. Enable wallet feature flag for internal users only.
4. Create pilot vendors for one site.
5. Run shadow reconciliation against manual finance records.
6. Validate 5 to 10 business days of clean operation.
7. Expand to more sites.
8. Enable commission settlement.
9. Enable selective automation and alerts.

## Final Recommendation

If you want a wallet system that behaves like a bank account for vendors, the only safe production pattern here is:

- vendor wallet master data
- immutable double-entry ledger
- reservation-before-token flow
- explicit commission accrual
- reconciliation engine
- exception queue
- daily settlement
- strong approvals and audit trail

For this repo specifically, the smartest implementation is to keep token generation on the existing upstream integration path while making the wallet, funding, reconciliation, and finance control layers native to Supabase and the Node backend.

That is the shortest path to a real working vendor-wallet subsystem without destabilizing the current CRM.
