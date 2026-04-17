insert into public.collections_priority_facts (
  meter_sn,
  site_code,
  customer_name,
  account_no,
  priority_score,
  days_since_last_recharge,
  outstanding_balance,
  recommended_action,
  reasons,
  metadata,
  generated_at
)
with latest_open_cases as (
  select
    meter_sn,
    count(*) filter (where status in ('new', 'active', 'investigating')) as open_case_count,
    max(score) as max_case_score
  from public.theft_cases
  group by meter_sn
),
ranked as (
  select
    m.meter_sn,
    m.site_code,
    c.customer_name,
    coalesce(a.account_no, c.account_no) as account_no,
    greatest(
      coalesce(round(extract(epoch from (timezone('utc', now()) - v.last_recharge_at)) / 86400), 0),
      0
    )::integer as days_since_last_recharge,
    round(
      least(
        100,
        coalesce(least(40, greatest(extract(epoch from (timezone('utc', now()) - v.last_recharge_at)) / 86400, 0)), 40) +
        coalesce(v.collections_priority_score, 0) * 0.35 +
        coalesce(v.leakage_score, 0) * 0.25 +
        coalesce(loc.max_case_score, 0) * 0.20
      )::numeric,
      3
    ) as priority_score,
    round(
      greatest(
        coalesce(v.total_recharge_amount_30d, 0) -
        (coalesce(v.avg_daily_consumption_7d, 0) * coalesce(v.estimated_days_covered, 0)),
        0
      )::numeric,
      2
    ) as outstanding_balance,
    case
      when coalesce(loc.open_case_count, 0) > 0 then 'Investigate active theft or tamper case'
      when coalesce(v.estimated_days_covered, 0) <= 2 then 'Contact customer before expected depletion'
      when coalesce(v.leakage_score, 0) >= 70 then 'Inspect for leakage and reconcile consumption'
      when v.last_recharge_at is null then 'Review account and meter activity'
      else 'Prioritize collections outreach'
    end as recommended_action,
    array_remove(array[
      case when coalesce(loc.open_case_count, 0) > 0 then 'open-theft-case' end,
      case when coalesce(v.estimated_days_covered, 0) <= 2 then 'low-cover' end,
      case when coalesce(v.leakage_score, 0) >= 70 then 'high-leakage-score' end,
      case when v.last_recharge_at is null then 'no-recent-recharge' end,
      case when greatest(
        coalesce(round(extract(epoch from (timezone('utc', now()) - v.last_recharge_at)) / 86400), 0),
        0
      ) >= 14 then 'stale-recharge' end
    ], null) as reasons,
    jsonb_build_object(
      'source', 'migration-backfill',
      'lastRechargeAt', v.last_recharge_at,
      'totalRechargeAmount30d', v.total_recharge_amount_30d,
      'avgDailyConsumption7d', v.avg_daily_consumption_7d,
      'estimatedDaysCovered', v.estimated_days_covered,
      'leakageScore', v.leakage_score,
      'openCaseCount', coalesce(loc.open_case_count, 0),
      'maxTheftCaseScore', coalesce(loc.max_case_score, 0)
    ) as metadata,
    timezone('utc', now()) as generated_at
  from public.v_customer_360 v
  join public.meters m
    on m.meter_sn = v.meter_sn
  left join public.customers c
    on c.id = m.customer_id
  left join public.accounts a
    on a.id = m.account_id
  left join latest_open_cases loc
    on loc.meter_sn = v.meter_sn
  where v.site_code is not null
)
select
  meter_sn,
  site_code,
  customer_name,
  account_no,
  priority_score,
  days_since_last_recharge,
  outstanding_balance,
  recommended_action,
  reasons,
  metadata,
  generated_at
from ranked
on conflict (meter_sn) do update
set site_code = excluded.site_code,
    customer_name = excluded.customer_name,
    account_no = excluded.account_no,
    priority_score = excluded.priority_score,
    days_since_last_recharge = excluded.days_since_last_recharge,
    outstanding_balance = excluded.outstanding_balance,
    recommended_action = excluded.recommended_action,
    reasons = excluded.reasons,
    metadata = excluded.metadata,
    generated_at = excluded.generated_at;

insert into public.runtime_health_facts (
  engine_name,
  category,
  site_code,
  status,
  freshness_score,
  dataset_age_minutes,
  last_success_at,
  last_failure_at,
  last_refreshed_at,
  error_message,
  metadata,
  generated_at
)
with last_runs as (
  select
    engine_name,
    max(started_at) filter (where status = 'completed') as last_success_at,
    max(started_at) filter (where status = 'failed') as last_failure_at,
    max(started_at) as last_seen_at,
    (
      array_agg(error_message order by started_at desc)
      filter (where status = 'failed' and error_message is not null)
    )[1] as latest_error
  from public.analysis_runs
  group by engine_name
),
engine_facts as (
  select
    'customer-daily-consumption'::text as engine_name,
    'consumption'::text as category,
    max(generated_at) as last_refreshed_at,
    count(*) as fact_count
  from public.customer_daily_consumption_facts
  union all
  select
    'recharge-ingestion',
    'revenue',
    max(transaction_at),
    count(*)
  from public.token_transactions
  union all
  select
    'revenue-leakage',
    'risk',
    max(generated_at),
    count(*)
  from public.revenue_leakage_facts
  union all
  select
    'operational-priority',
    'operations',
    max(generated_at),
    count(*)
  from public.operational_priority_queue
  union all
  select
    'collections-priority',
    'risk',
    max(generated_at),
    count(*)
  from public.collections_priority_facts
  union all
  select
    'site-benchmark',
    'consumption',
    max(generated_at),
    count(*)
  from public.site_consumption_facts
),
prepared as (
  select
    ef.engine_name,
    ef.category,
    null::text as site_code,
    case
      when ef.last_refreshed_at is null then 'offline'
      when lr.last_failure_at is not null
        and lr.last_success_at is null then 'critical'
      when extract(epoch from (timezone('utc', now()) - ef.last_refreshed_at)) / 60 > 720 then 'critical'
      when extract(epoch from (timezone('utc', now()) - ef.last_refreshed_at)) / 60 > 180 then 'warning'
      else 'healthy'
    end as status,
    round(
      greatest(
        0,
        least(
          100,
          100 - (
            coalesce(extract(epoch from (timezone('utc', now()) - ef.last_refreshed_at)) / 60, 1440) / 10
          )
        )
      )::numeric,
      2
    ) as freshness_score,
    coalesce(round(extract(epoch from (timezone('utc', now()) - ef.last_refreshed_at)) / 60), 999999)::integer as dataset_age_minutes,
    lr.last_success_at,
    lr.last_failure_at,
    ef.last_refreshed_at,
    lr.latest_error as error_message,
    jsonb_build_object(
      'source', 'migration-backfill',
      'factCount', coalesce(ef.fact_count, 0),
      'lastSeenAt', lr.last_seen_at
    ) as metadata,
    timezone('utc', now()) as generated_at
  from engine_facts ef
  left join last_runs lr
    on lr.engine_name = ef.engine_name
)
select
  engine_name,
  category,
  site_code,
  status,
  freshness_score,
  dataset_age_minutes,
  last_success_at,
  last_failure_at,
  last_refreshed_at,
  error_message,
  metadata,
  generated_at
from prepared
on conflict (engine_name) do update
set category = excluded.category,
    site_code = excluded.site_code,
    status = excluded.status,
    freshness_score = excluded.freshness_score,
    dataset_age_minutes = excluded.dataset_age_minutes,
    last_success_at = excluded.last_success_at,
    last_failure_at = excluded.last_failure_at,
    last_refreshed_at = excluded.last_refreshed_at,
    error_message = excluded.error_message,
    metadata = excluded.metadata,
    generated_at = excluded.generated_at;

select public.refresh_app_analytics_views();
