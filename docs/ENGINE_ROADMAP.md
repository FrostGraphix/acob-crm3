# Data Engine Delivery Table

## Implemented / Partial Engines

| Engine | Endpoints | Worker Schedule | Supabase Tables | Backend Services | Frontend Pages |
| --- | --- | --- | --- | --- | --- |
| Customer Daily Consumption Engine | `/api/customer/consumption-recharge-summary`, `/api/customer/consumption-recharge-daily`, `/api/customer/live-daily-consumption` | Dedicated customer-daily worker every 60s | `meter_daily_reads`, `customers`, `accounts`, `meters` | `customer-analytics`, `site-consumption-engine`, `supabase-db` | `/management/customer`, `/data-report/consumption-statistics`, `/dashboard` |
| Recharge Ingestion Engine | `/api/token/creditTokenRecord/readMore`, `/api/customer/consumption-recharge-summary` | Token analytics snapshot cache every 5 minutes | `token_transactions`, `customers`, `accounts` | `management-token-analytics`, `supabase-db` | `/token-record/credit-token-record`, `/management/customer`, `/management/analytics`, `/dashboard` |
| Sold vs Consumed Reconciliation Engine | `/api/token/reconciliation` | Read-on-demand with cached token snapshot | `token_transactions`, `meter_daily_reads` | `analytics-mix`, `management-token-analytics` | `/token-record/credit-token-record`, `/data-report/consumption-statistics`, `/management/customer` |
| Customer 360 Engine | `/api/customer/360-lite` | Snapshot/cache refresh every 10 minutes | `customers`, `accounts`, `meters`, `token_transactions` | `analytics-mix`, `management-token-analytics` | `/management/customer`, `/management/account`, `/management/meter` |
| Runtime Freshness Engine | `/api/runtime/engines`, `/health`, `/health/dependencies` | Runtime poll every 60 seconds | `runtime_health_facts` | `runtime`, `runtime-diagnostics` | `/system/runtime`, `/dashboard` |
| Collections Priority Engine | `/api/reports/collections-priority` | Read-on-demand with cached risk state | `collections_priority_facts`, `token_transactions`, `theft_cases` | `analytics-mix`, `theft-intelligence` | `/data-report/low-purchase`, `/data-report/long-nonpurchase`, `/management/customer` |
| Meter Health Engine | `/api/meter/performance-sheet` | Read-on-demand | `meters`, `meter_daily_reads` | `analytics-mix` | `/management/meter`, `/dashboard`, `/remote-operation/meter-reading` |
| Notification Correlation Engine | `/api/notifications/correlated-feed` | Notification poll every 60 seconds | `notifications`, `notification_receipts`, `theft_signals` | `analysis-engine`, `theft-intelligence`, `analytics-mix` | `/dashboard`, `/event-notification` |
| Master Data Consistency Engine | `/api/master-data/consistency` | Master-data quality scan every 6 hours | `customers`, `accounts`, `meters` | `analytics-mix` | `/management/customer`, `/management/account`, `/management/meter`, `/management/gateway`, `/management/tariff` |
| Site Benchmark Engine | `/api/management/analytics/site-benchmark`, `/api/site-consumption/loss-exposure` | Site consumption engine every 30 minutes, query cache every 15 minutes | `site_consumption_facts`, `token_transactions` | `site-consumption-engine`, `analytics-mix`, `management-token-analytics` | `/management/analytics`, `/data-report/site-consumption`, `/dashboard` |

## Planned Engines

| Engine | Endpoints | Worker Schedule | Supabase Tables | Backend Services | Frontend Pages |
| --- | --- | --- | --- | --- | --- |
| Revenue Leakage Engine | `/api/dashboard/risk-overlay` | Risk worker every 15 minutes | `revenue_leakage_facts`, `theft_signals`, `token_transactions`, `meter_daily_reads` | `analysis-engine`, `theft-intelligence`, `analytics-mix` | `/dashboard`, `/data-report/low-purchase`, `/data-report/long-nonpurchase`, `/data-report/theft-signals` |
| Customer Segmentation Engine | `/api/customer/segments` | Nightly segmentation worker | `customer_segments`, `token_transactions`, `meter_daily_reads`, `customers` | `customer-analytics` | `/management/customer`, `/management/analytics` |
| Depletion Forecast Engine | `/api/customer/forecasts` | Forecast worker every 15 minutes plus nightly rebuild | `customer_forecasts`, `meter_daily_reads`, `token_transactions` | `customer-analytics` | `/data-report/low-purchase`, `/management/customer`, `/dashboard` |
| Operational Priority Engine | `/api/runtime/operational-priority` | Operations worker every 5 minutes | `operational_priority_queue`, `runtime_health_facts` | `analytics-mix`, `runtime` | `/dashboard`, `/system/runtime`, `/management/analytics` |

## Exact Schemas By Engine Family

### Customer Daily Consumption Engine
- `meter_daily_reads(meter_sn, site_code, reading_date, consumption_kwh, raw_payload, created_at, updated_at)`
- `customers(id, upstream_id, name, phone, email, address, site_id, account_no, status, metadata, created_at, updated_at)`
- `accounts(id, upstream_id, customer_id, account_no, account_type, balance, site_id, status, metadata, created_at, updated_at)`
- `meters(id, upstream_id, meter_sn, account_id, customer_id, site_id, meter_type, communication_type, gateway_id, status, installed_at, last_read_at, last_read_value, metadata, created_at, updated_at)`

### Recharge / Reconciliation
- `token_transactions(upstream_transaction_id, meter_sn, site_code, amount, kwh, tariff_rate, transaction_at, raw_payload, created_at, updated_at)`
- `meter_daily_reads(...)`

### Site / Runtime / Risk
- `site_consumption_facts(site_code, period_granularity, period_start, period_end, consumption_kwh, generated_at, metadata)`
- `notifications(id, audience, user_id, target_site_code, category, severity, title, message, payload, created_by, created_at)`
- `notification_receipts(notification_id, user_id, read_at, dismissed_at)`
- `theft_signals(id, meter_sn, site_code, severity, score, signal_types, title, message, source_window, payload, created_at, updated_at)`
- `theft_cases(id, meter_sn, site_code, severity, score, status, owner_user_id, notes, created_at, updated_at, closed_at)`
