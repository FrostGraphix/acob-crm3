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
with token_rollup as (
  select
    tt.meter_sn,
    tt.site_code,
    max(tt.transaction_at) as last_recharge_at,
    count(*) filter (
      where tt.transaction_at >= timezone('utc', now()) - interval '30 days'
    ) as recharge_count_30d,
    sum(tt.amount) filter (
      where tt.transaction_at >= timezone('utc', now()) - interval '30 days'
    ) as total_recharge_amount_30d,
    (
      array_agg(tt.raw_payload ->> 'customerName' order by tt.transaction_at desc)
      filter (where tt.raw_payload ? 'customerName')
    )[1] as customer_name,
    (
      array_agg(tt.raw_payload ->> 'accountNo' order by tt.transaction_at desc)
      filter (where tt.raw_payload ? 'accountNo')
    )[1] as account_no
  from public.token_transactions tt
  where tt.meter_sn is not null
    and tt.site_code is not null
  group by tt.meter_sn, tt.site_code
)
select
  tr.meter_sn,
  tr.site_code,
  nullif(tr.customer_name, '') as customer_name,
  nullif(tr.account_no, '') as account_no,
  round(
    least(
      100,
      greatest(
        0,
        (
          least(
            greatest(extract(epoch from (timezone('utc', now()) - tr.last_recharge_at)) / 86400, 0),
            45
          ) * 1.5
        ) +
        (case when coalesce(tr.recharge_count_30d, 0) = 0 then 25 else 0 end) +
        (case when coalesce(tr.total_recharge_amount_30d, 0) < 1000 then 20 else 0 end)
      )
    )::numeric,
    3
  ) as priority_score,
  greatest(
    round(extract(epoch from (timezone('utc', now()) - tr.last_recharge_at)) / 86400),
    0
  )::integer as days_since_last_recharge,
  0::numeric(14, 2) as outstanding_balance,
  case
    when coalesce(tr.recharge_count_30d, 0) = 0 then 'Review dormant customer for collections follow-up'
    when coalesce(tr.total_recharge_amount_30d, 0) < 1000 then 'Contact customer about low recharge activity'
    else 'Monitor recharge pattern and prioritize if activity drops'
  end as recommended_action,
  array_remove(array[
    case when coalesce(tr.recharge_count_30d, 0) = 0 then 'no-recharge-last-30d' end,
    case when coalesce(tr.total_recharge_amount_30d, 0) < 1000 then 'low-vend-value' end,
    case when greatest(
      round(extract(epoch from (timezone('utc', now()) - tr.last_recharge_at)) / 86400),
      0
    ) >= 14 then 'stale-recharge' end
  ], null) as reasons,
  jsonb_build_object(
    'source', 'token-transaction-fallback-backfill',
    'lastRechargeAt', tr.last_recharge_at,
    'rechargeCount30d', coalesce(tr.recharge_count_30d, 0),
    'totalRechargeAmount30d', coalesce(tr.total_recharge_amount_30d, 0)
  ) as metadata,
  timezone('utc', now()) as generated_at
from token_rollup tr
on conflict (meter_sn) do update
set site_code = excluded.site_code,
    customer_name = coalesce(excluded.customer_name, public.collections_priority_facts.customer_name),
    account_no = coalesce(excluded.account_no, public.collections_priority_facts.account_no),
    priority_score = excluded.priority_score,
    days_since_last_recharge = excluded.days_since_last_recharge,
    outstanding_balance = excluded.outstanding_balance,
    recommended_action = excluded.recommended_action,
    reasons = excluded.reasons,
    metadata = excluded.metadata,
    generated_at = excluded.generated_at;
