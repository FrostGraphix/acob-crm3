alter type public.app_role add value if not exists 'vendor_manager';
alter type public.app_role add value if not exists 'vendor_user';

create or replace function public.wallet_current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'app_role', auth.jwt() ->> 'role', '');
$$;

create or replace function public.wallet_current_vendor_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'vendor_id', '');
$$;

create or replace function public.wallet_current_site_code()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'site_code', '');
$$;

create table if not exists public.vendor_organizations (
  id uuid primary key default gen_random_uuid(),
  vendor_code text not null unique,
  legal_name text not null,
  display_name text not null,
  status text not null default 'draft',
  site_code text not null references public.sites (code) on delete restrict,
  kyc_status text not null default 'pending',
  risk_rating text not null default 'standard',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vendor_organizations_status_check
    check (status in ('draft', 'pending_review', 'approved', 'active', 'suspended', 'closed', 'rejected')),
  constraint vendor_organizations_vendor_code_lowercase
    check (vendor_code = lower(vendor_code))
);

create table if not exists public.vendor_users (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_organizations (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  app_role public.app_role not null default 'vendor_user',
  site_code text not null references public.sites (code) on delete restrict,
  invited_by uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (vendor_id, auth_user_id),
  unique (auth_user_id)
);

create table if not exists public.vendor_wallets (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null unique references public.vendor_organizations (id) on delete cascade,
  wallet_number text not null unique,
  site_code text not null references public.sites (code) on delete restrict,
  currency_code text not null default 'NGN',
  status text not null default 'pending',
  allow_credit boolean not null default false,
  credit_limit numeric(14,2) not null default 0,
  frozen_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vendor_wallets_status_check
    check (status in ('pending', 'active', 'frozen', 'suspended', 'closed')),
  constraint vendor_wallets_currency_check
    check (currency_code in ('NGN'))
);

create table if not exists public.vendor_wallet_limits (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null unique references public.vendor_wallets (id) on delete cascade,
  daily_purchase_limit numeric(14,2) not null default 0,
  per_transaction_limit numeric(14,2) not null default 0,
  max_pending_reservations integer not null default 5,
  max_failed_funding_proofs integer not null default 3,
  rapid_purchase_threshold integer not null default 10,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.vendor_commission_rules (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null unique references public.vendor_organizations (id) on delete cascade,
  site_code text not null references public.sites (code) on delete restrict,
  commission_rate numeric(9,4) not null default 0,
  settlement_mode text not null default 'wallet_credit',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vendor_commission_rules_settlement_mode_check
    check (settlement_mode in ('wallet_credit', 'bank_payout', 'manual'))
);

create table if not exists public.vendor_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_organizations (id) on delete cascade,
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  is_primary boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references public.vendor_wallets (id) on delete cascade,
  vendor_id uuid references public.vendor_organizations (id) on delete cascade,
  site_code text references public.sites (code) on delete restrict,
  account_code text not null,
  account_name text not null,
  account_type text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (wallet_id, account_code),
  constraint ledger_accounts_type_check
    check (account_type in ('asset', 'liability', 'equity', 'income', 'expense', 'memo'))
);

create table if not exists public.ledger_journals (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references public.vendor_wallets (id) on delete cascade,
  vendor_id uuid references public.vendor_organizations (id) on delete cascade,
  site_code text not null references public.sites (code) on delete restrict,
  journal_type text not null,
  source_type text not null,
  source_id text,
  business_date date not null default (timezone('Africa/Lagos', now()))::date,
  status text not null default 'posted',
  idempotency_key text,
  reference text not null,
  posted_by uuid references auth.users (id) on delete set null,
  amount numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  posted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint ledger_journals_status_check
    check (status in ('draft', 'posted', 'reversed'))
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.ledger_journals (id) on delete cascade,
  account_id uuid not null references public.ledger_accounts (id) on delete restrict,
  wallet_id uuid references public.vendor_wallets (id) on delete cascade,
  vendor_id uuid references public.vendor_organizations (id) on delete cascade,
  site_code text not null references public.sites (code) on delete restrict,
  entry_side text not null,
  amount numeric(14,2) not null,
  currency_code text not null default 'NGN',
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ledger_entries_side_check
    check (entry_side in ('debit', 'credit')),
  constraint ledger_entries_amount_positive_check
    check (amount >= 0)
);

create table if not exists public.wallet_balance_snapshots (
  wallet_id uuid primary key references public.vendor_wallets (id) on delete cascade,
  vendor_id uuid not null references public.vendor_organizations (id) on delete cascade,
  site_code text not null references public.sites (code) on delete restrict,
  available_balance numeric(14,2) not null default 0,
  reserved_balance numeric(14,2) not null default 0,
  total_funded numeric(14,2) not null default 0,
  total_purchased numeric(14,2) not null default 0,
  total_commission_accrued numeric(14,2) not null default 0,
  total_commission_settled numeric(14,2) not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wallet_funding_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_organizations (id) on delete cascade,
  wallet_id uuid not null references public.vendor_wallets (id) on delete cascade,
  site_code text not null references public.sites (code) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  channel text not null,
  reference text not null unique,
  proof_document_id uuid references public.documents (id) on delete set null,
  status text not null default 'initiated',
  notes text,
  approved_by uuid references auth.users (id) on delete set null,
  posted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wallet_funding_requests_channel_check
    check (channel in ('bank_transfer', 'cash_branch', 'payment_gateway', 'internal_transfer', 'cash_at_branch')),
  constraint wallet_funding_requests_status_check
    check (status in ('initiated', 'proof_uploaded', 'under_review', 'confirmed', 'posted', 'rejected', 'expired', 'cancelled'))
);

create table if not exists public.wallet_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_organizations (id) on delete cascade,
  wallet_id uuid not null references public.vendor_wallets (id) on delete cascade,
  site_code text not null references public.sites (code) on delete restrict,
  meter_sn text not null,
  customer_ref text,
  amount numeric(14,2) not null check (amount > 0),
  fee_amount numeric(14,2) not null default 0,
  commission_amount numeric(14,2) not null default 0,
  net_debit_amount numeric(14,2) not null default 0,
  status text not null default 'pending',
  idempotency_key text not null,
  delivery_method text not null check (delivery_method in ('remote_send', 'token_generate')),
  delivery_destination text,
  token_value text,
  upstream_request_ref text,
  upstream_transaction_id text,
  remote_send_ref text,
  token_transaction_id uuid references public.token_transactions (id) on delete set null,
  receipt_ref uuid,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  requested_by uuid references auth.users (id) on delete set null,
  reserved_journal_id uuid references public.ledger_journals (id) on delete set null,
  final_journal_id uuid references public.ledger_journals (id) on delete set null,
  released_journal_id uuid references public.ledger_journals (id) on delete set null,
  reserved_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (wallet_id, idempotency_key),
  constraint wallet_purchase_orders_status_check
    check (status in ('pending', 'reserved', 'processing', 'successful', 'failed', 'reversed', 'manual_review'))
);

create table if not exists public.wallet_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.wallet_purchase_orders (id) on delete cascade,
  vendor_id uuid not null references public.vendor_organizations (id) on delete cascade,
  site_code text not null references public.sites (code) on delete restrict,
  delivery_method text not null check (delivery_method in ('remote_send', 'token_generate')),
  meter_sn text not null,
  customer_ref text,
  amount numeric(12,2) not null check (amount > 0),
  token_value text,
  remote_send_ref text,
  issued_at timestamptz not null default timezone('utc', now()),
  receipt_number text not null unique,
  issued_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.wallet_purchase_orders
  add constraint wallet_purchase_orders_receipt_ref_fkey
  foreign key (receipt_ref) references public.wallet_receipts (id) on delete set null;

create table if not exists public.wallet_reversal_cases (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.wallet_purchase_orders (id) on delete cascade,
  vendor_id uuid not null references public.vendor_organizations (id) on delete cascade,
  wallet_id uuid not null references public.vendor_wallets (id) on delete cascade,
  site_code text not null references public.sites (code) on delete restrict,
  status text not null default 'requested',
  requested_by uuid references auth.users (id) on delete set null,
  approved_by uuid references auth.users (id) on delete set null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wallet_reversal_cases_status_check
    check (status in ('requested', 'under_review', 'approved', 'rejected', 'posted'))
);

create table if not exists public.wallet_settlement_batches (
  id uuid primary key default gen_random_uuid(),
  site_code text not null references public.sites (code) on delete restrict,
  business_date date not null,
  status text not null default 'preview',
  total_commission_credits numeric(14,2) not null default 0,
  item_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  posted_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  posted_at timestamptz,
  unique (site_code, business_date),
  constraint wallet_settlement_batches_status_check
    check (status in ('preview', 'posted', 'failed'))
);

create table if not exists public.wallet_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  site_code text references public.sites (code) on delete restrict,
  status text not null default 'running',
  dry_run boolean not null default false,
  triggered_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  exception_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  constraint wallet_reconciliation_runs_status_check
    check (status in ('running', 'completed', 'failed'))
);

create table if not exists public.wallet_exceptions (
  id uuid primary key default gen_random_uuid(),
  exception_type text not null,
  severity text not null,
  status text not null default 'open',
  site_code text references public.sites (code) on delete restrict,
  vendor_id uuid references public.vendor_organizations (id) on delete cascade,
  wallet_id uuid references public.vendor_wallets (id) on delete cascade,
  purchase_order_id uuid references public.wallet_purchase_orders (id) on delete cascade,
  funding_request_id uuid references public.wallet_funding_requests (id) on delete cascade,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  assignee_user_id uuid references auth.users (id) on delete set null,
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wallet_exceptions_severity_check
    check (severity in ('low', 'medium', 'high', 'critical')),
  constraint wallet_exceptions_status_check
    check (status in ('open', 'assigned', 'resolved'))
);

create sequence if not exists public.receipt_number_seq start 100000 increment 1;

create or replace function public.generate_receipt_number()
returns text
language sql
as $$
  select 'RCP-' || to_char(timezone('Africa/Lagos', now()), 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0');
$$;

create or replace function public.seed_vendor_wallet_defaults()
returns trigger
language plpgsql
as $$
begin
  insert into public.vendor_commission_rules (vendor_id, site_code, commission_rate, settlement_mode)
  values (new.id, new.site_code, 0.00, 'wallet_credit')
  on conflict (vendor_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_vendor_wallet_defaults on public.vendor_organizations;
create trigger trg_vendor_wallet_defaults
after insert on public.vendor_organizations
for each row execute function public.seed_vendor_wallet_defaults();

create index if not exists idx_vendor_users_vendor on public.vendor_users (vendor_id);
create index if not exists idx_vendor_users_auth on public.vendor_users (auth_user_id);
create index if not exists idx_vendor_wallets_site on public.vendor_wallets (site_code, status);
create index if not exists idx_wallet_funding_requests_vendor on public.wallet_funding_requests (vendor_id, created_at desc);
create index if not exists idx_wallet_purchase_orders_wallet on public.wallet_purchase_orders (wallet_id, created_at desc);
create index if not exists idx_wallet_purchase_orders_meter on public.wallet_purchase_orders (meter_sn);
create index if not exists idx_wallet_receipts_vendor on public.wallet_receipts (vendor_id, issued_at desc);
create index if not exists idx_wallet_exceptions_status on public.wallet_exceptions (status, severity, created_at desc);
create index if not exists idx_ledger_journals_wallet on public.ledger_journals (wallet_id, posted_at desc);
create index if not exists idx_ledger_entries_wallet on public.ledger_entries (wallet_id, created_at desc);

create index if not exists idx_wallet_purchase_orders_idempotency
  on public.wallet_purchase_orders (wallet_id, idempotency_key);

create index if not exists idx_wallet_reconciliation_runs_site
  on public.wallet_reconciliation_runs (site_code, started_at desc);

alter table public.vendor_organizations enable row level security;
alter table public.vendor_users enable row level security;
alter table public.vendor_wallets enable row level security;
alter table public.vendor_wallet_limits enable row level security;
alter table public.vendor_commission_rules enable row level security;
alter table public.vendor_bank_accounts enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_journals enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.wallet_balance_snapshots enable row level security;
alter table public.wallet_funding_requests enable row level security;
alter table public.wallet_purchase_orders enable row level security;
alter table public.wallet_receipts enable row level security;
alter table public.wallet_reversal_cases enable row level security;
alter table public.wallet_settlement_batches enable row level security;
alter table public.wallet_reconciliation_runs enable row level security;
alter table public.wallet_exceptions enable row level security;

create policy vendor_organizations_read_scoped on public.vendor_organizations
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
      and site_code = public.wallet_current_site_code()
    )
    or id::text = public.wallet_current_vendor_id()
  );

create policy vendor_organizations_service_all on public.vendor_organizations
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy vendor_users_read_scoped on public.vendor_users
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or auth_user_id = auth.uid()
  );

create policy vendor_users_service_all on public.vendor_users
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy vendor_wallets_read_scoped on public.vendor_wallets
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
      and site_code = public.wallet_current_site_code()
    )
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy vendor_wallets_service_all on public.vendor_wallets
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy vendor_wallet_limits_read_scoped on public.vendor_wallet_limits
  for select using (
    auth.role() = 'service_role'
    or wallet_id in (
      select vw.id
      from public.vendor_wallets vw
      where vw.vendor_id::text = public.wallet_current_vendor_id()
         or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
         or (
           public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
           and vw.site_code = public.wallet_current_site_code()
         )
    )
  );

create policy vendor_wallet_limits_service_all on public.vendor_wallet_limits
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy vendor_commission_rules_read_scoped on public.vendor_commission_rules
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy vendor_commission_rules_service_all on public.vendor_commission_rules
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy vendor_bank_accounts_read_scoped on public.vendor_bank_accounts
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy vendor_bank_accounts_service_all on public.vendor_bank_accounts
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy ledger_accounts_read_scoped on public.ledger_accounts
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy ledger_accounts_service_all on public.ledger_accounts
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy ledger_journals_read_scoped on public.ledger_journals
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
      and site_code = public.wallet_current_site_code()
    )
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy ledger_journals_service_all on public.ledger_journals
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy ledger_entries_read_scoped on public.ledger_entries
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
      and site_code = public.wallet_current_site_code()
    )
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy ledger_entries_insert_service on public.ledger_entries
  for insert with check (auth.role() = 'service_role');

create policy ledger_entries_no_update on public.ledger_entries
  for update using (false);

create policy ledger_entries_no_delete on public.ledger_entries
  for delete using (false);

create policy wallet_balance_snapshots_read_scoped on public.wallet_balance_snapshots
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy wallet_balance_snapshots_service_all on public.wallet_balance_snapshots
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy wallet_funding_requests_read_scoped on public.wallet_funding_requests
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
      and site_code = public.wallet_current_site_code()
    )
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy wallet_funding_requests_insert_vendor on public.wallet_funding_requests
  for insert with check (
    auth.role() = 'service_role'
    or (
      public.wallet_current_app_role() = 'vendor_user'
      and vendor_id::text = public.wallet_current_vendor_id()
    )
  );

create policy wallet_purchase_orders_read_scoped on public.wallet_purchase_orders
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
      and site_code = public.wallet_current_site_code()
    )
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy wallet_purchase_orders_insert_vendor on public.wallet_purchase_orders
  for insert with check (
    auth.role() = 'service_role'
    or (
      public.wallet_current_app_role() = 'vendor_user'
      and vendor_id::text = public.wallet_current_vendor_id()
    )
  );

create policy wallet_receipts_read_scoped on public.wallet_receipts
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
      and site_code = public.wallet_current_site_code()
    )
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy wallet_receipts_insert_service on public.wallet_receipts
  for insert with check (auth.role() = 'service_role');

create policy wallet_reversal_cases_read_scoped on public.wallet_reversal_cases
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy wallet_reversal_cases_service_all on public.wallet_reversal_cases
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy wallet_settlement_batches_read_scoped on public.wallet_settlement_batches
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
  );

create policy wallet_settlement_batches_service_all on public.wallet_settlement_batches
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy wallet_reconciliation_runs_read_scoped on public.wallet_reconciliation_runs
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() = 'ops_manager'
      and site_code = public.wallet_current_site_code()
    )
  );

create policy wallet_reconciliation_runs_service_all on public.wallet_reconciliation_runs
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy wallet_exceptions_read_scoped on public.wallet_exceptions
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() = 'ops_manager'
      and site_code = public.wallet_current_site_code()
    )
  );

create policy wallet_exceptions_service_all on public.wallet_exceptions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy customers_vendor_site_scope on public.customers
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager', 'vendor_user')
      and site_code = public.wallet_current_site_code()
    )
  );

create policy meters_vendor_site_scope on public.meters
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager', 'vendor_user')
      and site_code = public.wallet_current_site_code()
    )
  );

create trigger trg_vendor_organizations_updated_at
before update on public.vendor_organizations
for each row execute function public.set_updated_at();

create trigger trg_vendor_wallets_updated_at
before update on public.vendor_wallets
for each row execute function public.set_updated_at();

create trigger trg_vendor_wallet_limits_updated_at
before update on public.vendor_wallet_limits
for each row execute function public.set_updated_at();

create trigger trg_vendor_commission_rules_updated_at
before update on public.vendor_commission_rules
for each row execute function public.set_updated_at();

create trigger trg_vendor_bank_accounts_updated_at
before update on public.vendor_bank_accounts
for each row execute function public.set_updated_at();
