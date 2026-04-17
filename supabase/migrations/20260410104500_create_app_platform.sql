create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$
begin
  create type public.app_role as enum (
    'super_admin',
    'admin',
    'ops_manager',
    'finance',
    'field_agent',
    'analyst',
    'viewer'
  );
exception
  when duplicate_object then null;
end
$$;

alter type public.app_role add value if not exists 'super_admin';
alter type public.app_role add value if not exists 'admin';
alter type public.app_role add value if not exists 'ops_manager';
alter type public.app_role add value if not exists 'finance';
alter type public.app_role add value if not exists 'field_agent';
alter type public.app_role add value if not exists 'analyst';
alter type public.app_role add value if not exists 'viewer';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.sites (
  code text primary key,
  name text not null,
  region text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sites_code_lowercase check (code = lower(code))
);

insert into public.sites (code, name, region)
values
  ('musha', 'Musha', 'Africa/Lagos'),
  ('ogufa', 'Ogufa', 'Africa/Lagos'),
  ('umaisha', 'Umaisha', 'Africa/Lagos'),
  ('tunga', 'Tunga', 'Africa/Lagos'),
  ('kyakale', 'Kyakale', 'Africa/Lagos')
on conflict (code) do update
set name = excluded.name,
    region = excluded.region;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  display_name text not null default '',
  phone text,
  primary_site_code text references public.sites (code) on delete set null,
  timezone text not null default 'Africa/Lagos',
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  scope_site_code text references public.sites (code) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_roles'
      and column_name = 'scope_site_code'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_roles'
      and column_name = 'role'
  ) then
    execute 'create unique index if not exists user_roles_unique_scope_idx on public.user_roles (user_id, role, coalesce(scope_site_code, ''''))';
  end if;
end
$$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null,
  user_id uuid references auth.users (id) on delete cascade,
  target_role public.app_role,
  target_site_code text references public.sites (code) on delete cascade,
  category text not null default 'general',
  severity text not null default 'info',
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  constraint notifications_audience_check
    check (audience in ('global', 'user', 'role', 'site')),
  constraint notifications_severity_check
    check (severity in ('info', 'warning', 'critical'))
);

create table if not exists public.notification_receipts (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (notification_id, user_id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  bucket_name text not null,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  checksum text,
  entity_type text,
  entity_id text,
  site_code text references public.sites (code) on delete set null,
  uploaded_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'ui',
  entity_type text not null,
  status text not null default 'pending',
  requested_by uuid references auth.users (id) on delete set null,
  file_document_id uuid references public.documents (id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  constraint import_jobs_status_check
    check (status in ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

create table if not exists public.import_job_rows (
  id bigint generated by default as identity primary key,
  import_job_id uuid not null references public.import_jobs (id) on delete cascade,
  row_number integer not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint import_job_rows_status_check
    check (status in ('pending', 'processed', 'failed', 'skipped'))
);

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  site_code text references public.sites (code) on delete set null,
  source text not null default 'backend',
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.audit_logs
  add column if not exists actor_user_id uuid references auth.users (id) on delete set null,
  add column if not exists action text,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists site_code text references public.sites (code) on delete set null,
  add column if not exists source text not null default 'backend',
  add column if not exists request_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  upstream_customer_id text unique,
  customer_name text not null,
  account_no text,
  phone text,
  email text,
  address text,
  site_code text references public.sites (code) on delete set null,
  source text not null default 'upstream',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  search_document tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(customer_name, '') || ' ' ||
      coalesce(account_no, '') || ' ' ||
      coalesce(phone, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(address, '')
    )
  ) stored
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  upstream_account_id text unique,
  customer_id uuid references public.customers (id) on delete set null,
  account_no text unique,
  status text,
  site_code text references public.sites (code) on delete set null,
  opened_at timestamptz,
  closed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.meters (
  id uuid primary key default gen_random_uuid(),
  upstream_meter_id text unique,
  meter_sn text not null unique,
  customer_id uuid references public.customers (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  site_code text references public.sites (code) on delete set null,
  status text,
  meter_type text,
  tariff_id text,
  gateway_id text,
  installed_at timestamptz,
  last_seen_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  search_document tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(meter_sn, '') || ' ' ||
      coalesce(status, '') || ' ' ||
      coalesce(meter_type, '') || ' ' ||
      coalesce(tariff_id, '') || ' ' ||
      coalesce(gateway_id, '')
    )
  ) stored
);

create table if not exists public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  upstream_transaction_id text unique,
  meter_id uuid references public.meters (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  meter_sn text not null,
  site_code text not null references public.sites (code) on delete restrict,
  amount numeric(14, 2) not null default 0,
  kwh numeric(14, 3) not null default 0,
  tariff_rate text,
  transaction_at timestamptz not null,
  source text not null default 'upstream',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.meter_daily_reads (
  id uuid primary key default gen_random_uuid(),
  upstream_row_id text unique,
  meter_id uuid references public.meters (id) on delete set null,
  meter_sn text not null,
  site_code text not null references public.sites (code) on delete restrict,
  reading_date date not null,
  consumption_kwh numeric(14, 3) not null default 0,
  voltage numeric(10, 3),
  current numeric(10, 3),
  power_factor numeric(10, 4),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (meter_sn, reading_date)
);

create table if not exists public.meter_events (
  id uuid primary key default gen_random_uuid(),
  upstream_event_id text unique,
  meter_id uuid references public.meters (id) on delete set null,
  meter_sn text not null,
  site_code text not null references public.sites (code) on delete restrict,
  event_type text not null,
  severity text not null default 'info',
  event_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint meter_events_severity_check
    check (severity in ('info', 'warning', 'critical'))
);

create table if not exists public.remote_tasks (
  id uuid primary key default gen_random_uuid(),
  upstream_task_id text unique,
  requested_by uuid references auth.users (id) on delete set null,
  meter_id uuid references public.meters (id) on delete set null,
  meter_sn text not null,
  site_code text not null references public.sites (code) on delete restrict,
  task_type text not null,
  task_name text,
  risk_level text not null default 'medium',
  status text not null default 'pending',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint remote_tasks_status_check
    check (status in ('pending', 'queued', 'running', 'success', 'failed', 'cancelled', 'unknown')),
  constraint remote_tasks_risk_level_check
    check (risk_level in ('low', 'medium', 'high'))
);

create table if not exists public.theft_signals (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid references public.meters (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  meter_sn text not null,
  site_code text not null references public.sites (code) on delete restrict,
  severity text not null,
  score numeric(8, 2) not null default 0,
  signal_types text[] not null default '{}'::text[],
  title text not null,
  message text not null,
  status text not null default 'active',
  source_window jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  constraint theft_signals_severity_check
    check (severity in ('watch', 'suspect', 'critical')),
  constraint theft_signals_status_check
    check (status in ('active', 'resolved'))
);

create table if not exists public.theft_cases (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid references public.meters (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  meter_sn text not null,
  site_code text not null references public.sites (code) on delete restrict,
  severity text not null,
  score numeric(8, 2) not null default 0,
  status text not null default 'new',
  owner_user_id uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  constraint theft_cases_severity_check
    check (severity in ('watch', 'suspect', 'critical')),
  constraint theft_cases_status_check
    check (status in ('new', 'active', 'investigating', 'confirmed-theft', 'false-positive', 'closed'))
);

create table if not exists public.theft_case_signals (
  theft_case_id uuid not null references public.theft_cases (id) on delete cascade,
  theft_signal_id uuid not null references public.theft_signals (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (theft_case_id, theft_signal_id)
);

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  engine_name text not null,
  status text not null default 'running',
  initiated_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  duration_ms integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint analysis_runs_status_check
    check (status in ('running', 'completed', 'failed', 'cancelled'))
);

create table if not exists public.site_consumption_facts (
  id uuid primary key default gen_random_uuid(),
  site_code text not null references public.sites (code) on delete restrict,
  period_granularity text not null,
  period_start date not null,
  period_end date not null,
  consumption_kwh numeric(14, 3) not null default 0,
  source_window_from date,
  source_window_to date,
  generated_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  constraint site_consumption_facts_granularity_check
    check (period_granularity in ('daily', 'monthly', 'yearly')),
  unique (site_code, period_granularity, period_start, period_end)
);

alter table if exists public.profiles
  add column if not exists primary_site_code text references public.sites (code) on delete set null,
  add column if not exists timezone text not null default 'Africa/Lagos',
  add column if not exists is_active boolean not null default true,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.user_roles
  add column if not exists role public.app_role,
  add column if not exists scope_site_code text references public.sites (code) on delete cascade,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_roles'
      and column_name = 'role_id'
  ) then
    update public.user_roles ur
    set role = r.name::text::public.app_role
    from public.roles r
    where ur.role is null
      and ur.role_id = r.id;
  end if;
end
$$;

alter table if exists public.notifications
  add column if not exists audience text not null default 'global',
  add column if not exists target_role public.app_role,
  add column if not exists target_site_code text references public.sites (code) on delete cascade,
  add column if not exists category text not null default 'general',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists expires_at timestamptz;

update public.notifications
set category = coalesce(nullif(category, ''), nullif(source, ''), 'general')
where category is null or category = '';

update public.notifications
set payload = payload
  || case when meter_id is not null then jsonb_build_object('meterId', meter_id) else '{}'::jsonb end
  || case when source is not null then jsonb_build_object('source', source) else '{}'::jsonb end
where payload = '{}'::jsonb or payload is null;

create table if not exists public.notification_receipts (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (notification_id, user_id)
);

alter table if exists public.documents
  add column if not exists bucket_name text not null default 'acob-documents',
  add column if not exists content_type text,
  add column if not exists size_bytes bigint,
  add column if not exists checksum text,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists site_code text references public.sites (code) on delete set null;

update public.documents
set content_type = coalesce(content_type, mime_type),
    size_bytes = coalesce(size_bytes, file_size),
    entity_type = coalesce(entity_type, case when meter_id is not null then 'meter' when customer_id is not null then 'customer' else null end),
    entity_id = coalesce(entity_id, meter_id, customer_id),
    site_code = coalesce(site_code, lower(site_id))
where content_type is null
   or size_bytes is null
   or entity_type is null
   or entity_id is null
   or site_code is null;

alter table if exists public.import_jobs
  add column if not exists source text not null default 'ui',
  add column if not exists entity_type text,
  add column if not exists requested_by uuid references auth.users (id) on delete set null,
  add column if not exists file_document_id uuid references public.documents (id) on delete set null,
  add column if not exists summary jsonb not null default '{}'::jsonb,
  add column if not exists error_message text;

update public.import_jobs
set entity_type = coalesce(entity_type, job_type, 'generic'),
    requested_by = coalesce(requested_by, initiated_by),
    summary = case
      when summary is null or summary = '{}'::jsonb then coalesce(result, '{}'::jsonb)
      else summary
    end
where entity_type is null
   or requested_by is null
   or summary is null;

create table if not exists public.import_job_rows (
  id bigint generated by default as identity primary key,
  import_job_id uuid not null references public.import_jobs (id) on delete cascade,
  row_number integer not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  site_code text references public.sites (code) on delete set null,
  source text not null default 'backend',
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.customers
  add column if not exists upstream_customer_id text,
  add column if not exists customer_name text,
  add column if not exists account_no text,
  add column if not exists site_code text references public.sites (code) on delete set null,
  add column if not exists source text not null default 'upstream',
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

update public.customers
set upstream_customer_id = coalesce(upstream_customer_id, upstream_id),
    customer_name = coalesce(customer_name, name),
    account_no = coalesce(account_no, nullif(account_no, '')),
    site_code = coalesce(site_code, lower(site_id)),
    raw_payload = case
      when raw_payload is null or raw_payload = '{}'::jsonb then coalesce(metadata, '{}'::jsonb)
      else raw_payload
    end
where upstream_customer_id is null
   or customer_name is null
   or site_code is null
   or raw_payload is null;

alter table if exists public.customers
  add column if not exists search_document tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(customer_name, '') || ' ' ||
      coalesce(account_no, '') || ' ' ||
      coalesce(phone, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(address, '')
    )
  ) stored;

alter table if exists public.accounts
  add column if not exists upstream_account_id text,
  add column if not exists site_code text references public.sites (code) on delete set null,
  add column if not exists opened_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

update public.accounts
set upstream_account_id = coalesce(upstream_account_id, upstream_id),
    site_code = coalesce(site_code, lower(site_id)),
    raw_payload = case
      when raw_payload is null or raw_payload = '{}'::jsonb then coalesce(metadata, '{}'::jsonb)
      else raw_payload
    end
where upstream_account_id is null
   or site_code is null
   or raw_payload is null;

alter table if exists public.meters
  add column if not exists upstream_meter_id text,
  add column if not exists site_code text references public.sites (code) on delete set null,
  add column if not exists tariff_id text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

update public.meters
set upstream_meter_id = coalesce(upstream_meter_id, upstream_id),
    site_code = coalesce(site_code, lower(site_id)),
    last_seen_at = coalesce(last_seen_at, last_read_at),
    raw_payload = case
      when raw_payload is null or raw_payload = '{}'::jsonb then coalesce(metadata, '{}'::jsonb)
      else raw_payload
    end
where upstream_meter_id is null
   or site_code is null
   or raw_payload is null;

alter table if exists public.meters
  add column if not exists search_document tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(meter_sn, '') || ' ' ||
      coalesce(status, '') || ' ' ||
      coalesce(meter_type, '') || ' ' ||
      coalesce(tariff_id, '') || ' ' ||
      coalesce(gateway_id, '')
    )
  ) stored;

alter table if exists public.token_transactions
  add column if not exists upstream_transaction_id text,
  add column if not exists meter_id uuid references public.meters (id) on delete set null,
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists site_code text references public.sites (code) on delete restrict,
  add column if not exists transaction_at timestamptz,
  add column if not exists source text not null default 'upstream',
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

update public.token_transactions
set upstream_transaction_id = coalesce(upstream_transaction_id, upstream_id),
    site_code = coalesce(site_code, lower(site_id)),
    transaction_at = coalesce(transaction_at, transaction_ts),
    raw_payload = case
      when raw_payload is null or raw_payload = '{}'::jsonb then jsonb_build_object(
        'customerName', customer_name,
        'accountNo', account_no
      )
      else raw_payload
    end
where upstream_transaction_id is null
   or site_code is null
   or transaction_at is null
   or raw_payload is null;

alter table if exists public.meter_daily_reads
  add column if not exists upstream_row_id text,
  add column if not exists meter_sn text,
  add column if not exists site_code text references public.sites (code) on delete restrict,
  add column if not exists reading_date date,
  add column if not exists voltage numeric(10, 3),
  add column if not exists current numeric(10, 3),
  add column if not exists power_factor numeric(10, 4),
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

update public.meter_daily_reads
set meter_sn = coalesce(meter_sn, meter_id::text),
    site_code = coalesce(site_code, lower(site_id)),
    reading_date = coalesce(reading_date, read_date),
    raw_payload = case
      when raw_payload is null or raw_payload = '{}'::jsonb then jsonb_build_object('source', source)
      else raw_payload
    end
where meter_sn is null
   or site_code is null
   or reading_date is null
   or raw_payload is null;

alter table if exists public.meter_events
  add column if not exists upstream_event_id text,
  add column if not exists site_code text references public.sites (code) on delete restrict,
  add column if not exists event_at timestamptz,
  add column if not exists payload jsonb not null default '{}'::jsonb;

update public.meter_events
set event_at = coalesce(event_at, event_ts),
    payload = case
      when payload is null or payload = '{}'::jsonb then coalesce(metadata, '{}'::jsonb)
      else payload
    end
where event_at is null
   or payload is null;

alter table if exists public.remote_tasks
  add column if not exists requested_by uuid references auth.users (id) on delete set null,
  add column if not exists site_code text references public.sites (code) on delete restrict,
  add column if not exists task_name text,
  add column if not exists risk_level text not null default 'medium',
  add column if not exists request_payload jsonb not null default '{}'::jsonb,
  add column if not exists response_payload jsonb not null default '{}'::jsonb,
  add column if not exists queued_at timestamptz not null default timezone('utc', now());

update public.remote_tasks
set requested_by = coalesce(requested_by, initiated_by),
    task_name = coalesce(task_name, task_type::text),
    request_payload = case
      when request_payload is null or request_payload = '{}'::jsonb then coalesce(payload, '{}'::jsonb)
      else request_payload
    end,
    response_payload = case
      when response_payload is null or response_payload = '{}'::jsonb then coalesce(result, '{}'::jsonb)
      else response_payload
    end,
    queued_at = coalesce(queued_at, created_at)
where requested_by is null
   or task_name is null
   or request_payload is null
   or response_payload is null;

alter table if exists public.theft_signals
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists meter_sn text,
  add column if not exists site_code text references public.sites (code) on delete restrict,
  add column if not exists source_window jsonb not null default '{}'::jsonb,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists resolved_at timestamptz;

update public.theft_signals
set meter_sn = coalesce(meter_sn, meter_id::text),
    source_window = case
      when source_window is null or source_window = '{}'::jsonb then jsonb_build_object('dateBucket', date_bucket)
      else source_window
    end,
    payload = case
      when payload is null or payload = '{}'::jsonb then jsonb_build_object('customerName', customer_name)
      else payload
    end,
    resolved_at = case when status = 'resolved' then coalesce(resolved_at, updated_at) else resolved_at end
where meter_sn is null
   or source_window is null
   or payload is null;

alter table if exists public.theft_cases
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists meter_sn text,
  add column if not exists site_code text references public.sites (code) on delete restrict,
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null;

update public.theft_cases
set meter_sn = coalesce(meter_sn, meter_id::text)
where meter_sn is null;

create table if not exists public.theft_case_signals (
  theft_case_id uuid not null references public.theft_cases (id) on delete cascade,
  theft_signal_id uuid not null references public.theft_signals (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (theft_case_id, theft_signal_id)
);

insert into public.theft_case_signals (theft_case_id, theft_signal_id)
select tc.id, signal_id
from public.theft_cases tc
cross join lateral unnest(tc.signal_ids) as signal_id
on conflict do nothing;

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  engine_name text not null,
  status text not null default 'running',
  initiated_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  duration_ms integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.site_consumption_facts (
  id uuid primary key default gen_random_uuid(),
  site_code text not null references public.sites (code) on delete restrict,
  period_granularity text not null,
  period_start date not null,
  period_end date not null,
  consumption_kwh numeric(14, 3) not null default 0,
  source_window_from date,
  source_window_to date,
  generated_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  unique (site_code, period_granularity, period_start, period_end)
);

insert into public.site_consumption_facts (
  site_code,
  period_granularity,
  period_start,
  period_end,
  consumption_kwh,
  generated_at,
  metadata
)
select
  lower(site_id),
  'daily',
  read_date,
  read_date,
  total_kwh,
  timezone('utc', now()),
  jsonb_build_object('meterCount', meter_count)
from public.v_site_daily_consumption
where site_id is not null
on conflict (site_code, period_granularity, period_start, period_end) do nothing;

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists notification_receipts_user_idx
  on public.notification_receipts (user_id, read_at, dismissed_at);

create index if not exists documents_entity_idx
  on public.documents (entity_type, entity_id);

create index if not exists documents_site_idx
  on public.documents (site_code, created_at desc);

create index if not exists import_jobs_requested_by_idx
  on public.import_jobs (requested_by, status, created_at desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index if not exists customers_site_idx
  on public.customers (site_code, customer_name);

create index if not exists customers_search_idx
  on public.customers using gin (search_document);

create index if not exists accounts_customer_idx
  on public.accounts (customer_id, site_code);

create index if not exists meters_site_idx
  on public.meters (site_code, status);

create index if not exists meters_customer_idx
  on public.meters (customer_id, account_id);

create index if not exists meters_search_idx
  on public.meters using gin (search_document);

create index if not exists token_transactions_site_time_idx
  on public.token_transactions (site_code, transaction_at desc);

create index if not exists token_transactions_meter_time_idx
  on public.token_transactions (meter_sn, transaction_at desc);

create index if not exists meter_daily_reads_site_date_idx
  on public.meter_daily_reads (site_code, reading_date desc);

create index if not exists meter_events_site_time_idx
  on public.meter_events (site_code, event_at desc);

create index if not exists remote_tasks_status_idx
  on public.remote_tasks (status, queued_at desc);

create index if not exists remote_tasks_site_idx
  on public.remote_tasks (site_code, queued_at desc);

create index if not exists theft_signals_status_idx
  on public.theft_signals (status, severity, created_at desc);

create index if not exists theft_cases_status_idx
  on public.theft_cases (status, severity, created_at desc);

create index if not exists analysis_runs_engine_idx
  on public.analysis_runs (engine_name, started_at desc);

create index if not exists site_consumption_facts_site_period_idx
  on public.site_consumption_facts (site_code, period_granularity, period_start desc);

create or replace view public.token_transactions_daily_v as
select
  tt.site_code,
  (tt.transaction_at at time zone 'Africa/Lagos')::date as transaction_date,
  sum(
    case
      when extract(hour from tt.transaction_at at time zone 'Africa/Lagos') between 6 and 17
        then tt.kwh
      else 0
    end
  )::numeric(14, 3) as day_kwh,
  sum(
    case
      when extract(hour from tt.transaction_at at time zone 'Africa/Lagos') not between 6 and 17
        then tt.kwh
      else 0
    end
  )::numeric(14, 3) as night_kwh,
  sum(tt.kwh)::numeric(14, 3) as total_kwh,
  sum(
    case
      when extract(hour from tt.transaction_at at time zone 'Africa/Lagos') between 6 and 17
        then tt.amount
      else 0
    end
  )::numeric(14, 2) as day_revenue,
  sum(
    case
      when extract(hour from tt.transaction_at at time zone 'Africa/Lagos') not between 6 and 17
        then tt.amount
      else 0
    end
  )::numeric(14, 2) as night_revenue,
  sum(tt.amount)::numeric(14, 2) as total_revenue,
  count(*)::integer as transaction_count
from public.token_transactions tt
group by tt.site_code, (tt.transaction_at at time zone 'Africa/Lagos')::date;

create or replace view public.meter_consumption_rank_v as
select
  tt.site_code,
  tt.meter_sn,
  min(tt.customer_id::text)::uuid as customer_id,
  sum(
    case
      when extract(hour from tt.transaction_at at time zone 'Africa/Lagos') between 6 and 17
        then tt.kwh
      else 0
    end
  )::numeric(14, 3) as day_kwh,
  sum(
    case
      when extract(hour from tt.transaction_at at time zone 'Africa/Lagos') not between 6 and 17
        then tt.kwh
      else 0
    end
  )::numeric(14, 3) as night_kwh,
  sum(tt.kwh)::numeric(14, 3) as total_kwh,
  sum(tt.amount)::numeric(14, 2) as total_revenue,
  max(tt.transaction_at) as last_transaction_at
from public.token_transactions tt
group by tt.site_code, tt.meter_sn;

create or replace trigger sites_set_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

create or replace trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create or replace trigger import_jobs_set_updated_at
before update on public.import_jobs
for each row execute function public.set_updated_at();

create or replace trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create or replace trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create or replace trigger meters_set_updated_at
before update on public.meters
for each row execute function public.set_updated_at();

create or replace trigger remote_tasks_set_updated_at
before update on public.remote_tasks
for each row execute function public.set_updated_at();

create or replace trigger theft_signals_set_updated_at
before update on public.theft_signals
for each row execute function public.set_updated_at();

create or replace trigger theft_cases_set_updated_at
before update on public.theft_cases
for each row execute function public.set_updated_at();
