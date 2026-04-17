
CREATE TABLE public.import_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiated_by  uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  job_type      text NOT NULL,
  status        public.import_job_status NOT NULL DEFAULT 'pending',
  file_name     text,
  storage_path  text,
  total_rows    integer,
  processed_rows integer DEFAULT 0,
  error_count   integer DEFAULT 0,
  errors        jsonb DEFAULT '[]'::jsonb,
  result        jsonb DEFAULT '{}'::jsonb,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.import_jobs IS
  'Tracks background import/export/sync jobs with progress and error details.';

CREATE TRIGGER import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE INDEX idx_import_jobs_user     ON public.import_jobs (initiated_by);
CREATE INDEX idx_import_jobs_status   ON public.import_jobs (status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_import_jobs_created  ON public.import_jobs (created_at DESC);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_jobs_service ON public.import_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY import_jobs_select ON public.import_jobs
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (auth.uid() = initiated_by OR public.user_has_role('admin'))
  );

-- Enable Realtime for import job progress tracking
ALTER TABLE public.import_jobs REPLICA IDENTITY FULL;

-- ── Materialized view: daily token summary ─────────────────
CREATE MATERIALIZED VIEW public.mv_token_daily_summary AS
SELECT
  site_id,
  date_trunc('day', transaction_ts)::date AS tx_date,
  COUNT(*)                                AS tx_count,
  SUM(amount)                             AS total_revenue,
  SUM(kwh)                                AS total_kwh,
  COUNT(DISTINCT meter_sn)                AS unique_meters
FROM public.token_transactions
GROUP BY site_id, date_trunc('day', transaction_ts)
ORDER BY tx_date DESC, site_id;

CREATE UNIQUE INDEX idx_mv_token_daily_summary
  ON public.mv_token_daily_summary (site_id, tx_date);

-- ── Materialized view: monthly token summary ───────────────
CREATE MATERIALIZED VIEW public.mv_token_monthly_summary AS
SELECT
  site_id,
  date_trunc('month', transaction_ts)::date AS tx_month,
  COUNT(*)                                  AS tx_count,
  SUM(amount)                               AS total_revenue,
  SUM(kwh)                                  AS total_kwh,
  COUNT(DISTINCT meter_sn)                  AS unique_meters
FROM public.token_transactions
GROUP BY site_id, date_trunc('month', transaction_ts)
ORDER BY tx_month DESC, site_id;

CREATE UNIQUE INDEX idx_mv_token_monthly_summary
  ON public.mv_token_monthly_summary (site_id, tx_month);

-- ── Helper: refresh materialized views ─────────────────────
CREATE OR REPLACE FUNCTION public.refresh_token_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_token_daily_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_token_monthly_summary;
END;
$$;
;
