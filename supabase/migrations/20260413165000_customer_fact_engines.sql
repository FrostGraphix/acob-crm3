CREATE TABLE IF NOT EXISTS public.customer_daily_recharge_facts (
  meter_sn TEXT NOT NULL,
  fact_date DATE NOT NULL,
  site_code TEXT,
  customer_name TEXT,
  account_no TEXT,
  recharge_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  recharge_kwh NUMERIC(14, 3) NOT NULL DEFAULT 0,
  recharge_count INTEGER NOT NULL DEFAULT 0,
  last_transaction_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (meter_sn, fact_date)
);

ALTER TABLE public.customer_daily_recharge_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_daily_recharge_facts" ON public.customer_daily_recharge_facts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_customer_daily_recharge_facts" ON public.customer_daily_recharge_facts
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_daily_recharge_site_date
  ON public.customer_daily_recharge_facts(site_code, fact_date DESC);

CREATE TABLE IF NOT EXISTS public.customer_daily_consumption_facts (
  meter_sn TEXT NOT NULL,
  fact_date DATE NOT NULL,
  site_code TEXT,
  customer_name TEXT,
  account_no TEXT,
  consumption_kwh NUMERIC(14, 3) NOT NULL DEFAULT 0,
  last_read_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (meter_sn, fact_date)
);

ALTER TABLE public.customer_daily_consumption_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_daily_consumption_facts" ON public.customer_daily_consumption_facts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_customer_daily_consumption_facts" ON public.customer_daily_consumption_facts
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_customer_daily_consumption_site_date
  ON public.customer_daily_consumption_facts(site_code, fact_date DESC);

CREATE TABLE IF NOT EXISTS public.customer_segments (
  meter_sn TEXT PRIMARY KEY,
  site_code TEXT,
  customer_name TEXT,
  account_no TEXT,
  segment TEXT NOT NULL,
  recharge_count_30d INTEGER NOT NULL DEFAULT 0,
  total_recharge_amount_30d NUMERIC(14, 2) NOT NULL DEFAULT 0,
  avg_daily_consumption_7d NUMERIC(14, 3) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_segments" ON public.customer_segments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_customer_segments" ON public.customer_segments
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.customer_forecasts (
  meter_sn TEXT PRIMARY KEY,
  site_code TEXT,
  customer_name TEXT,
  avg_daily_consumption_7d NUMERIC(14, 3) NOT NULL DEFAULT 0,
  avg_recharge_kwh_30d NUMERIC(14, 3) NOT NULL DEFAULT 0,
  estimated_days_covered NUMERIC(14, 3) NOT NULL DEFAULT 0,
  predicted_next_recharge_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customer_forecasts" ON public.customer_forecasts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_customer_forecasts" ON public.customer_forecasts
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.revenue_leakage_facts (
  meter_sn TEXT PRIMARY KEY,
  site_code TEXT,
  customer_name TEXT,
  leakage_score NUMERIC(14, 3) NOT NULL DEFAULT 0,
  estimated_loss_kwh NUMERIC(14, 3) NOT NULL DEFAULT 0,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_leakage_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_revenue_leakage_facts" ON public.revenue_leakage_facts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_revenue_leakage_facts" ON public.revenue_leakage_facts
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.operational_priority_queue (
  meter_sn TEXT PRIMARY KEY,
  site_code TEXT,
  customer_name TEXT,
  priority_score NUMERIC(14, 3) NOT NULL DEFAULT 0,
  recommended_action TEXT NOT NULL,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_priority_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_operational_priority_queue" ON public.operational_priority_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_operational_priority_queue" ON public.operational_priority_queue
  FOR SELECT TO authenticated USING (true);
