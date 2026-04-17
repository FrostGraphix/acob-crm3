# Supabase Blueprint For ACOB CRM3

This folder turns Supabase into a real project subsystem for ACOB CRM3 instead of limiting it to auth and storage credentials.

## What these migrations add

- App identity tables: `profiles`, `user_roles`
- Access-control helpers and row-level security policies
- Site reference data
- Operational tables: `notifications`, `documents`, `import_jobs`, `audit_logs`
- Reporting warehouse tables: `customers`, `accounts`, `meters`, `token_transactions`, `meter_daily_reads`, `meter_events`
- Runtime and investigation tables: `remote_tasks`, `theft_signals`, `theft_cases`, `analysis_runs`, `site_consumption_facts`
- Starter views for management analytics:
  - `public.token_transactions_daily_v`
  - `public.meter_consumption_rank_v`

## Why this matches the current codebase

The current app still reads and writes most operational data through the upstream Meter System, while Supabase is only used for auth and storage in:

- [backend/src/services/supabase.ts](../backend/src/services/supabase.ts)
- [backend/src/api/auth.ts](../backend/src/api/auth.ts)

The new Supabase schema is designed to become the durable app-native layer behind:

- runtime notifications from [backend/src/services/analysis-engine.ts](../backend/src/services/analysis-engine.ts)
- site-consumption snapshots from [backend/src/services/site-consumption-engine.ts](../backend/src/services/site-consumption-engine.ts)
- management analytics from [backend/src/services/management-token-analytics.ts](../backend/src/services/management-token-analytics.ts)
- future document upload flows that should stop proxying everything upstream

## Recommended rollout order

1. Apply the migrations and seed data.
2. Mirror runtime notifications into `public.notifications` and `public.notification_receipts`.
3. Mirror site-consumption snapshots into `public.site_consumption_facts`.
4. Mirror token history into `public.token_transactions`.
5. Switch analytics endpoints to query the Supabase views instead of rebuilding in memory.
6. Move document metadata into `public.documents` and use Supabase signed uploads.
7. Add Realtime subscriptions for notifications and runtime jobs in the frontend.

## Suggested commands

After authenticating the Supabase CLI on this machine:

```powershell
npx supabase link --project-ref qpoipyqgrjsjdvfqmxok
npx supabase db push
```

If you want the site seed data applied after the schema:

```powershell
npx supabase db reset
```

or run `supabase/seed.sql` manually in the SQL editor for the existing remote project.

## First backend integrations to build next

- Replace in-memory notifications in [backend/src/api/notification.ts](../backend/src/api/notification.ts) with Supabase-backed reads/writes.
- Replace `runtime-state-store` persistence for analysis and site-consumption snapshots with Supabase tables.
- Replace the cached token analytics snapshot with warehouse sync jobs that populate `token_transactions`.
- Add document endpoints that create signed upload URLs with the existing helpers in [backend/src/services/supabase.ts](../backend/src/services/supabase.ts).

## Security model

- `service_role` remains server-only.
- Browser access should use anon/public keys plus RLS.
- Site-scoped access is enforced by:
  - `profiles.primary_site_code`
  - `user_roles.scope_site_code`
  - helper functions in `20260410105000_create_rls_and_realtime.sql`
