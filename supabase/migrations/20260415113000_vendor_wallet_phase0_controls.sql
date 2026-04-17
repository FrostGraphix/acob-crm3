alter table public.vendor_users
  add column if not exists role text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists status text not null default 'pending_password_reset',
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.vendor_users
set
  role = coalesce(role, app_role::text),
  created_by = coalesce(created_by, invited_by)
where role is null or created_by is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_users_role_check'
  ) then
    alter table public.vendor_users
      add constraint vendor_users_role_check
      check (role in ('vendor_user', 'vendor_manager'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendor_users_status_check'
  ) then
    alter table public.vendor_users
      add constraint vendor_users_status_check
      check (status in ('pending_password_reset', 'active', 'suspended', 'locked'));
  end if;
end $$;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  site_code text references public.sites (code) on delete restrict,
  action_type text not null,
  target_type text not null,
  target_id text,
  status text not null default 'pending',
  maker_id uuid references auth.users (id) on delete set null,
  checker_id uuid references auth.users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  maker_at timestamptz not null default timezone('utc', now()),
  checker_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint approval_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

create table if not exists public.vendor_session_log (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_organizations (id) on delete cascade,
  auth_user_id uuid references auth.users (id) on delete set null,
  site_code text not null references public.sites (code) on delete restrict,
  ip_address inet,
  user_agent text,
  device_fingerprint_hash text,
  business_date date not null default (timezone('Africa/Lagos', now()))::date,
  purchase_count_business_day integer not null default 0,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_vendor_session_log_vendor_day
  on public.vendor_session_log (vendor_id, business_date desc);

create index if not exists idx_vendor_session_log_site_day
  on public.vendor_session_log (site_code, business_date desc);

create index if not exists idx_approval_requests_status
  on public.approval_requests (status, created_at desc);

alter table public.approval_requests enable row level security;
alter table public.vendor_session_log enable row level security;

create policy approval_requests_read_scoped on public.approval_requests
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() = 'ops_manager'
      and site_code = public.wallet_current_site_code()
    )
  );

create policy approval_requests_service_all on public.approval_requests
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy vendor_session_log_read_scoped on public.vendor_session_log
  for select using (
    auth.role() = 'service_role'
    or public.wallet_current_app_role() in ('super_admin', 'admin', 'finance')
    or (
      public.wallet_current_app_role() in ('ops_manager', 'vendor_manager')
      and site_code = public.wallet_current_site_code()
    )
    or vendor_id::text = public.wallet_current_vendor_id()
  );

create policy vendor_session_log_service_all on public.vendor_session_log
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create trigger trg_vendor_users_updated_at
before update on public.vendor_users
for each row execute function public.set_updated_at();

create trigger trg_approval_requests_updated_at
before update on public.approval_requests
for each row execute function public.set_updated_at();

create trigger trg_vendor_session_log_updated_at
before update on public.vendor_session_log
for each row execute function public.set_updated_at();
