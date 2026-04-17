
CREATE TABLE public.meter_daily_reads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id        text NOT NULL,
  site_id         text NOT NULL,
  read_date       date NOT NULL,
  consumption_kwh numeric(14,4) NOT NULL DEFAULT 0,
  source          text NOT NULL DEFAULT 'upstream',
  ingested_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meter_id, read_date)
);

COMMENT ON TABLE public.meter_daily_reads IS
  'Daily consumption per meter, ingested from upstream DailyDataMeter/read. Deduped on (meter_id, read_date) with UPSERT.';

CREATE INDEX idx_daily_reads_site
  ON public.meter_daily_reads (site_id, read_date DESC);
CREATE INDEX idx_daily_reads_date
  ON public.meter_daily_reads (read_date DESC);

-- ── Site consumption summary view ──────────────────────────
CREATE OR REPLACE VIEW public.v_site_daily_consumption AS
SELECT
  site_id,
  read_date,
  SUM(consumption_kwh) AS total_kwh,
  COUNT(DISTINCT meter_id) AS meter_count
FROM public.meter_daily_reads
GROUP BY site_id, read_date
ORDER BY read_date DESC, site_id;

CREATE OR REPLACE VIEW public.v_site_monthly_consumption AS
SELECT
  site_id,
  date_trunc('month', read_date)::date AS month,
  SUM(consumption_kwh) AS total_kwh,
  COUNT(DISTINCT meter_id) AS meter_count
FROM public.meter_daily_reads
GROUP BY site_id, date_trunc('month', read_date)
ORDER BY month DESC, site_id;

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.meter_daily_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_reads_service ON public.meter_daily_reads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY daily_reads_select ON public.meter_daily_reads
  FOR SELECT USING (auth.uid() IS NOT NULL);
;
