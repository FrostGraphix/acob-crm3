create table if not exists public.runtime_health_facts (
  engine_name text primary key,
  category text,
  site_code text references public.sites (code) on delete set null,
  status text not null default 'healthy',
  freshness_score numeric(6, 2) not null default 100,
  dataset_age_minutes integer not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_refreshed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default timezone('utc', now()),
  constraint runtime_health_facts_status_check
    check (status in ('healthy', 'warning', 'critical', 'offline'))
);

alter table public.runtime_health_facts enable row level security;

create policy "service_role_runtime_health_facts"
  on public.runtime_health_facts
  for all
  to service_role
  using (true)
  with check (true);

create policy "authenticated_read_runtime_health_facts"
  on public.runtime_health_facts
  for select
  to authenticated
  using (
    site_code is null
    or public.is_admin()
    or public.can_access_site(site_code)
  );

create table if not exists public.collections_priority_facts (
  meter_sn text primary key,
  site_code text references public.sites (code) on delete set null,
  customer_name text,
  account_no text,
  priority_score numeric(14, 3) not null default 0,
  days_since_last_recharge integer not null default 0,
  outstanding_balance numeric(14, 2) not null default 0,
  recommended_action text not null,
  reasons text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default timezone('utc', now())
);

alter table public.collections_priority_facts enable row level security;

create policy "service_role_collections_priority_facts"
  on public.collections_priority_facts
  for all
  to service_role
  using (true)
  with check (true);

create policy "authenticated_read_collections_priority_facts"
  on public.collections_priority_facts
  for select
  to authenticated
  using (
    public.is_admin()
    or public.can_access_site(site_code)
  );

create index if not exists site_consumption_facts_granularity_site_date_idx
  on public.site_consumption_facts (period_granularity, site_code, period_start desc);

create index if not exists site_consumption_facts_generated_at_idx
  on public.site_consumption_facts (generated_at desc);

create index if not exists analysis_runs_status_started_idx
  on public.analysis_runs (status, started_at desc);

create index if not exists analysis_runs_metadata_idx
  on public.analysis_runs using gin (metadata);

create index if not exists remote_tasks_site_status_idx
  on public.remote_tasks (site_code, status, queued_at desc);

create index if not exists remote_tasks_request_payload_idx
  on public.remote_tasks using gin (request_payload);

create index if not exists remote_tasks_response_payload_idx
  on public.remote_tasks using gin (response_payload);

create index if not exists documents_search_idx
  on public.documents using gin (
    to_tsvector(
      'simple',
      coalesce(file_name, '') || ' ' ||
      coalesce(metadata ->> 'title', '') || ' ' ||
      coalesce(metadata ->> 'description', '') || ' ' ||
      coalesce(entity_type, '') || ' ' ||
      coalesce(entity_id, '')
    )
  );

create index if not exists documents_metadata_idx
  on public.documents using gin (metadata);

create index if not exists theft_cases_search_idx
  on public.theft_cases using gin (
    to_tsvector(
      'simple',
      coalesce(meter_sn, '') || ' ' ||
      coalesce(notes, '')
    )
  );

create index if not exists customer_segments_site_generated_idx
  on public.customer_segments (site_code, generated_at desc);

create index if not exists customer_forecasts_site_prediction_idx
  on public.customer_forecasts (site_code, predicted_next_recharge_date, generated_at desc);

create index if not exists revenue_leakage_site_score_idx
  on public.revenue_leakage_facts (site_code, leakage_score desc, generated_at desc);

create index if not exists operational_priority_site_score_idx
  on public.operational_priority_queue (site_code, priority_score desc, generated_at desc);

create index if not exists collections_priority_site_score_idx
  on public.collections_priority_facts (site_code, priority_score desc, generated_at desc);

create index if not exists runtime_health_status_generated_idx
  on public.runtime_health_facts (status, generated_at desc);

create or replace view public.v_customer_360
with (security_invoker = true)
as
with recharge_30d as (
  select
    meter_sn,
    sum(recharge_amount) as total_recharge_amount_30d,
    sum(recharge_count) as recharge_count_30d,
    max(last_transaction_at) as last_recharge_at
  from public.customer_daily_recharge_facts
  where fact_date >= current_date - interval '30 days'
  group by meter_sn
),
consumption_7d as (
  select
    meter_sn,
    avg(consumption_kwh) as avg_daily_consumption_7d
  from public.customer_daily_consumption_facts
  where fact_date >= current_date - interval '7 days'
  group by meter_sn
)
select
  m.meter_sn,
  m.site_code,
  c.id as customer_id,
  c.customer_name,
  coalesce(a.account_no, c.account_no) as account_no,
  m.status as meter_status,
  r.last_recharge_at,
  coalesce(r.total_recharge_amount_30d, 0)::numeric(14, 2) as total_recharge_amount_30d,
  coalesce(r.recharge_count_30d, 0)::integer as recharge_count_30d,
  coalesce(c7.avg_daily_consumption_7d, 0)::numeric(14, 3) as avg_daily_consumption_7d,
  cs.segment,
  cf.avg_recharge_kwh_30d,
  cf.estimated_days_covered,
  cf.predicted_next_recharge_date,
  rlf.leakage_score,
  opq.priority_score as operational_priority_score,
  cpf.priority_score as collections_priority_score,
  greatest(
    coalesce(opq.generated_at, '-infinity'::timestamptz),
    coalesce(cpf.generated_at, '-infinity'::timestamptz),
    coalesce(cs.generated_at, '-infinity'::timestamptz),
    coalesce(cf.generated_at, '-infinity'::timestamptz),
    coalesce(rlf.generated_at, '-infinity'::timestamptz)
  ) as updated_at
from public.meters m
left join public.customers c
  on c.id = m.customer_id
left join public.accounts a
  on a.id = m.account_id
left join recharge_30d r
  on r.meter_sn = m.meter_sn
left join consumption_7d c7
  on c7.meter_sn = m.meter_sn
left join public.customer_segments cs
  on cs.meter_sn = m.meter_sn
left join public.customer_forecasts cf
  on cf.meter_sn = m.meter_sn
left join public.revenue_leakage_facts rlf
  on rlf.meter_sn = m.meter_sn
left join public.operational_priority_queue opq
  on opq.meter_sn = m.meter_sn
left join public.collections_priority_facts cpf
  on cpf.meter_sn = m.meter_sn;

create or replace view public.v_customer_risk_summary
with (security_invoker = true)
as
with open_cases as (
  select
    meter_sn,
    count(*) filter (where status in ('new', 'active', 'investigating')) as open_case_count,
    max(score) as max_theft_score
  from public.theft_cases
  group by meter_sn
)
select
  m.meter_sn,
  m.site_code,
  c.customer_name,
  coalesce(a.account_no, c.account_no) as account_no,
  coalesce(oc.open_case_count, 0)::integer as open_case_count,
  coalesce(oc.max_theft_score, 0)::numeric(8, 2) as max_theft_score,
  coalesce(rlf.leakage_score, 0)::numeric(14, 3) as leakage_score,
  coalesce(opq.priority_score, 0)::numeric(14, 3) as operational_priority_score,
  coalesce(cpf.priority_score, 0)::numeric(14, 3) as collections_priority_score,
  (
    coalesce(rlf.leakage_score, 0) +
    coalesce(opq.priority_score, 0) +
    coalesce(cpf.priority_score, 0) +
    coalesce(oc.max_theft_score, 0)
  )::numeric(14, 3) as blended_risk_score,
  array_remove(array[
    case when coalesce(oc.open_case_count, 0) > 0 then 'open-theft-case' end,
    case when coalesce(rlf.leakage_score, 0) >= 70 then 'high-leakage' end,
    case when coalesce(cpf.priority_score, 0) >= 70 then 'collections-priority' end,
    case when coalesce(opq.priority_score, 0) >= 70 then 'operations-priority' end
  ], null) as flags
from public.meters m
left join public.customers c
  on c.id = m.customer_id
left join public.accounts a
  on a.id = m.account_id
left join open_cases oc
  on oc.meter_sn = m.meter_sn
left join public.revenue_leakage_facts rlf
  on rlf.meter_sn = m.meter_sn
left join public.operational_priority_queue opq
  on opq.meter_sn = m.meter_sn
left join public.collections_priority_facts cpf
  on cpf.meter_sn = m.meter_sn;

create materialized view if not exists public.mv_customer_site_rollups
as
select
  site_code,
  count(*) as customer_count,
  count(*) filter (where segment = 'high-value') as high_value_count,
  count(*) filter (where segment = 'at-risk') as at_risk_count,
  avg(avg_daily_consumption_7d)::numeric(14, 3) as avg_daily_consumption_7d,
  avg(total_recharge_amount_30d)::numeric(14, 2) as avg_recharge_amount_30d,
  max(updated_at) as generated_at
from public.v_customer_360
where site_code is not null
group by site_code;

create unique index if not exists mv_customer_site_rollups_site_idx
  on public.mv_customer_site_rollups (site_code);

revoke all on public.mv_customer_site_rollups from anon, authenticated;
grant select on public.mv_customer_site_rollups to service_role;

create or replace view public.v_global_search
with (security_invoker = true)
as
select
  'customer'::text as entity_type,
  c.id::text as entity_id,
  c.site_code,
  c.customer_name as title,
  coalesce(c.account_no, c.phone, c.email, c.address, '') as subtitle,
  c.search_document,
  c.updated_at
from public.customers c
union all
select
  'meter'::text as entity_type,
  m.id::text as entity_id,
  m.site_code,
  m.meter_sn as title,
  coalesce(m.status, m.meter_type, m.gateway_id, '') as subtitle,
  m.search_document,
  m.updated_at
from public.meters m
union all
select
  'document'::text as entity_type,
  d.id::text as entity_id,
  d.site_code,
  coalesce(d.metadata ->> 'title', d.file_name) as title,
  coalesce(d.metadata ->> 'description', d.entity_type, '') as subtitle,
  to_tsvector(
    'simple',
    coalesce(d.file_name, '') || ' ' ||
    coalesce(d.metadata ->> 'title', '') || ' ' ||
    coalesce(d.metadata ->> 'description', '') || ' ' ||
    coalesce(d.entity_type, '') || ' ' ||
    coalesce(d.entity_id, '')
  ) as search_document,
  d.updated_at
from public.documents d
union all
select
  'theft-case'::text as entity_type,
  tc.id::text as entity_id,
  tc.site_code,
  tc.meter_sn as title,
  coalesce(tc.status::text, '') || ' ' || coalesce(tc.severity::text, '') as subtitle,
  to_tsvector(
    'simple',
    coalesce(tc.meter_sn, '') || ' ' ||
    coalesce(tc.notes, '')
  ) as search_document,
  tc.updated_at
from public.theft_cases tc;

create or replace function public.search_global(
  p_term text,
  p_limit integer default 25
)
returns table (
  entity_type text,
  entity_id text,
  site_code text,
  title text,
  subtitle text,
  updated_at timestamptz,
  rank real
)
language sql
stable
set search_path = ''
as $$
  with query_term as (
    select nullif(trim(p_term), '') as term
  )
  select
    v.entity_type,
    v.entity_id,
    v.site_code,
    v.title,
    v.subtitle,
    v.updated_at,
    ts_rank(v.search_document, plainto_tsquery('simple', qt.term)) as rank
  from public.v_global_search v
  cross join query_term qt
  where qt.term is not null
    and v.search_document @@ plainto_tsquery('simple', qt.term)
  order by rank desc, v.updated_at desc nulls last
  limit greatest(coalesce(p_limit, 25), 1);
$$;

create or replace function public.get_unread_notifications(
  p_user_id uuid default auth.uid(),
  p_limit integer default 200
)
returns table (
  id uuid,
  severity text,
  title text,
  message text,
  payload jsonb,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    n.id,
    n.severity,
    n.title,
    n.message,
    n.payload,
    n.created_at
  from public.notifications n
  left join public.notification_receipts nr
    on nr.notification_id = n.id
   and nr.user_id = p_user_id
  where public.can_view_notification(n.audience, n.user_id, n.target_role, n.target_site_code)
    and (n.expires_at is null or n.expires_at > timezone('utc', now()))
    and (nr.read_at is null and nr.dismissed_at is null)
  order by n.created_at desc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

create or replace function public.refresh_app_analytics_views()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view public.mv_token_daily_summary;
  refresh materialized view public.mv_token_monthly_summary;
  refresh materialized view public.mv_customer_site_rollups;
end;
$$;

create or replace function public.cleanup_app_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_receipts_deleted integer := 0;
  notifications_deleted integer := 0;
  analysis_runs_deleted integer := 0;
  remote_tasks_deleted integer := 0;
  import_jobs_deleted integer := 0;
  audit_logs_deleted integer := 0;
begin
  delete from public.notification_receipts
  where coalesce(dismissed_at, read_at, created_at) < timezone('utc', now()) - interval '180 days';
  get diagnostics notification_receipts_deleted = row_count;

  delete from public.notifications
  where (
      expires_at is not null
      and expires_at < timezone('utc', now()) - interval '30 days'
    )
    or (
      expires_at is null
      and created_at < timezone('utc', now()) - interval '90 days'
    );
  get diagnostics notifications_deleted = row_count;

  delete from public.analysis_runs
  where status <> 'running'
    and started_at < timezone('utc', now()) - interval '60 days';
  get diagnostics analysis_runs_deleted = row_count;

  delete from public.remote_tasks
  where status in ('success', 'failed', 'cancelled', 'unknown')
    and queued_at < timezone('utc', now()) - interval '60 days';
  get diagnostics remote_tasks_deleted = row_count;

  delete from public.import_jobs
  where status in ('completed', 'failed', 'cancelled')
    and coalesce(completed_at, updated_at, created_at) < timezone('utc', now()) - interval '90 days';
  get diagnostics import_jobs_deleted = row_count;

  delete from public.audit_logs
  where created_at < timezone('utc', now()) - interval '365 days';
  get diagnostics audit_logs_deleted = row_count;

  return jsonb_build_object(
    'notificationReceiptsDeleted', notification_receipts_deleted,
    'notificationsDeleted', notifications_deleted,
    'analysisRunsDeleted', analysis_runs_deleted,
    'remoteTasksDeleted', remote_tasks_deleted,
    'importJobsDeleted', import_jobs_deleted,
    'auditLogsDeleted', audit_logs_deleted
  );
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    begin
      perform ext.cron.unschedule('refresh_app_analytics_views_hourly');
    exception
      when others then null;
    end;

    begin
      perform ext.cron.unschedule('cleanup_app_retention_daily');
    exception
      when others then null;
    end;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) then
    perform cron.schedule(
      'refresh_app_analytics_views_hourly',
      '5 * * * *',
      'select public.refresh_app_analytics_views()'
    );

    perform cron.schedule(
      'cleanup_app_retention_daily',
      '20 2 * * *',
      'select public.cleanup_app_retention()'
    );
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    begin
      alter publication supabase_realtime add table public.runtime_health_facts;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.operational_priority_queue;
    exception
      when duplicate_object then null;
    end;

    begin
      alter publication supabase_realtime add table public.collections_priority_facts;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;
