with ranked_tokens as (
  select
    tt.meter_sn,
    tt.site_code,
    nullif(tt.raw_payload ->> 'customerName', '') as customer_name,
    nullif(tt.raw_payload ->> 'accountNo', '') as account_no,
    format(
      'token:%s:%s:%s',
      tt.site_code,
      coalesce(nullif(tt.raw_payload ->> 'accountNo', ''), tt.meter_sn),
      tt.meter_sn
    ) as upstream_customer_id,
    row_number() over (
      partition by tt.meter_sn
      order by tt.transaction_at desc, tt.created_at desc
    ) as rn
  from public.token_transactions tt
  where tt.meter_sn is not null
    and tt.site_code is not null
),
latest_customers as (
  select
    upstream_customer_id,
    coalesce(customer_name, format('Customer %s', right(meter_sn, 4))) as customer_name,
    account_no,
    site_code,
    meter_sn
  from ranked_tokens
  where rn = 1
)
update public.customers c
set customer_name = lc.customer_name,
    name = coalesce(c.name, lc.customer_name),
    account_no = coalesce(lc.account_no, c.account_no),
    site_code = lc.site_code,
    site_id = coalesce(c.site_id, lc.site_code),
    upstream_id = coalesce(c.upstream_id, lc.upstream_customer_id),
    status = coalesce(c.status, 'active'),
    source = 'token-backfill',
    metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
      'seedSource', 'token_transactions'
    ),
    raw_payload = coalesce(c.raw_payload, '{}'::jsonb) || jsonb_build_object(
      'meterSn', lc.meter_sn,
      'seedSource', 'token_transactions'
    ),
    updated_at = timezone('utc', now())
from latest_customers lc
where c.upstream_customer_id = lc.upstream_customer_id;

with ranked_tokens as (
  select
    tt.meter_sn,
    tt.site_code,
    nullif(tt.raw_payload ->> 'customerName', '') as customer_name,
    nullif(tt.raw_payload ->> 'accountNo', '') as account_no,
    format(
      'token:%s:%s:%s',
      tt.site_code,
      coalesce(nullif(tt.raw_payload ->> 'accountNo', ''), tt.meter_sn),
      tt.meter_sn
    ) as upstream_customer_id,
    row_number() over (
      partition by tt.meter_sn
      order by tt.transaction_at desc, tt.created_at desc
    ) as rn
  from public.token_transactions tt
  where tt.meter_sn is not null
    and tt.site_code is not null
)
insert into public.customers (
  upstream_customer_id,
  customer_name,
  name,
  account_no,
  site_code,
  site_id,
  upstream_id,
  status,
  source,
  metadata,
  raw_payload
)
select
  rt.upstream_customer_id,
  coalesce(rt.customer_name, format('Customer %s', right(rt.meter_sn, 4))) as customer_name,
  coalesce(rt.customer_name, format('Customer %s', right(rt.meter_sn, 4))) as name,
  rt.account_no,
  rt.site_code,
  rt.site_code as site_id,
  rt.upstream_customer_id as upstream_id,
  'active' as status,
  'token-backfill' as source,
  jsonb_build_object(
    'seedSource', 'token_transactions'
  ) as metadata,
  jsonb_build_object(
    'meterSn', rt.meter_sn,
    'seedSource', 'token_transactions'
  ) as raw_payload
from ranked_tokens rt
where rt.rn = 1
  and not exists (
    select 1
    from public.customers c
    where c.upstream_customer_id = rt.upstream_customer_id
  );

with latest_accounts as (
  select
    tt.meter_sn,
    tt.site_code,
    nullif(tt.raw_payload ->> 'accountNo', '') as account_no,
    row_number() over (
      partition by nullif(tt.raw_payload ->> 'accountNo', '')
      order by tt.transaction_at desc, tt.created_at desc
    ) as rn
  from public.token_transactions tt
  where nullif(tt.raw_payload ->> 'accountNo', '') is not null
),
customer_lookup as (
  select
    c.id,
    c.account_no
  from public.customers c
  where c.account_no is not null
),
prepared_accounts as (
  select
    la.account_no as upstream_account_id,
    cl.id as customer_id,
    la.account_no,
    la.site_code,
    la.meter_sn
  from latest_accounts la
  left join customer_lookup cl
    on cl.account_no = la.account_no
  where la.rn = 1
)
update public.accounts a
set customer_id = coalesce(pa.customer_id, a.customer_id),
    site_code = pa.site_code,
    raw_payload = coalesce(a.raw_payload, '{}'::jsonb) || jsonb_build_object(
      'meterSn', pa.meter_sn,
      'seedSource', 'token_transactions'
    ),
    updated_at = timezone('utc', now())
from prepared_accounts pa
where a.account_no = pa.account_no;

with latest_accounts as (
  select
    tt.meter_sn,
    tt.site_code,
    nullif(tt.raw_payload ->> 'accountNo', '') as account_no,
    row_number() over (
      partition by nullif(tt.raw_payload ->> 'accountNo', '')
      order by tt.transaction_at desc, tt.created_at desc
    ) as rn
  from public.token_transactions tt
  where nullif(tt.raw_payload ->> 'accountNo', '') is not null
),
customer_lookup as (
  select
    c.id,
    c.account_no
  from public.customers c
  where c.account_no is not null
)
insert into public.accounts (
  upstream_account_id,
  customer_id,
  account_no,
  site_code,
  raw_payload
)
select
  la.account_no as upstream_account_id,
  cl.id as customer_id,
  la.account_no,
  la.site_code,
  jsonb_build_object(
    'meterSn', la.meter_sn,
    'seedSource', 'token_transactions'
  ) as raw_payload
from latest_accounts la
left join customer_lookup cl
  on cl.account_no = la.account_no
where la.rn = 1
  and not exists (
    select 1
    from public.accounts a
    where a.account_no = la.account_no
  );

with latest_meters as (
  select
    tt.meter_sn,
    tt.site_code,
    tt.transaction_at,
    nullif(tt.raw_payload ->> 'accountNo', '') as account_no,
    row_number() over (
      partition by tt.meter_sn
      order by tt.transaction_at desc, tt.created_at desc
    ) as rn
  from public.token_transactions tt
  where tt.meter_sn is not null
    and tt.site_code is not null
),
customer_lookup as (
  select
    c.id,
    c.account_no,
    c.site_code
  from public.customers c
),
account_lookup as (
  select
    a.id,
    a.account_no
  from public.accounts a
),
prepared_meters as (
  select
    lm.meter_sn as upstream_meter_id,
    cl.id as customer_id,
    al.id as account_id,
    lm.meter_sn,
    coalesce(lm.site_code, cl.site_code) as site_code,
    lm.transaction_at as last_seen_at,
    lm.account_no
  from latest_meters lm
  left join customer_lookup cl
    on cl.account_no = lm.account_no
  left join account_lookup al
    on al.account_no = lm.account_no
  where lm.rn = 1
)
update public.meters m
set customer_id = coalesce(pm.customer_id, m.customer_id),
    account_id = coalesce(pm.account_id, m.account_id),
    site_code = pm.site_code,
    last_seen_at = greatest(
      coalesce(m.last_seen_at, '-infinity'::timestamptz),
      coalesce(pm.last_seen_at, '-infinity'::timestamptz)
    ),
    raw_payload = coalesce(m.raw_payload, '{}'::jsonb) || jsonb_build_object(
      'accountNo', pm.account_no,
      'seedSource', 'token_transactions'
    ),
    updated_at = timezone('utc', now())
from prepared_meters pm
where m.meter_sn = pm.meter_sn;

with latest_meters as (
  select
    tt.meter_sn,
    tt.site_code,
    tt.transaction_at,
    nullif(tt.raw_payload ->> 'accountNo', '') as account_no,
    row_number() over (
      partition by tt.meter_sn
      order by tt.transaction_at desc, tt.created_at desc
    ) as rn
  from public.token_transactions tt
  where tt.meter_sn is not null
    and tt.site_code is not null
),
customer_lookup as (
  select
    c.id,
    c.account_no,
    c.site_code
  from public.customers c
),
account_lookup as (
  select
    a.id,
    a.account_no
  from public.accounts a
)
insert into public.meters (
  upstream_meter_id,
  customer_id,
  account_id,
  meter_sn,
  site_code,
  last_seen_at,
  raw_payload
)
select
  lm.meter_sn as upstream_meter_id,
  cl.id as customer_id,
  al.id as account_id,
  lm.meter_sn,
  coalesce(lm.site_code, cl.site_code) as site_code,
  lm.transaction_at as last_seen_at,
  jsonb_build_object(
    'accountNo', lm.account_no,
    'seedSource', 'token_transactions'
  ) as raw_payload
from latest_meters lm
left join customer_lookup cl
  on cl.account_no = lm.account_no
left join account_lookup al
  on al.account_no = lm.account_no
where lm.rn = 1
  and not exists (
    select 1
    from public.meters m
    where m.meter_sn = lm.meter_sn
  );
