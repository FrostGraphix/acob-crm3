
-- Fix security definer views to use SECURITY INVOKER instead
-- This ensures RLS policies of the underlying table are applied to the querying user

ALTER VIEW public.v_site_daily_consumption SET (security_invoker = on);
ALTER VIEW public.v_site_monthly_consumption SET (security_invoker = on);

-- Restrict materialized views to authenticated users only (revoke from anon)
REVOKE SELECT ON public.mv_token_daily_summary FROM anon;
REVOKE SELECT ON public.mv_token_monthly_summary FROM anon;
;
