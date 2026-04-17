
-- Phase 2: Missing warehouse tables
-- customers, accounts, meters, meter_events, remote_tasks

-- ── Customers ─────────────────────────────────────────────────
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upstream_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  site_id TEXT,
  account_no TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.customers IS 'Customer records synced from upstream system.';

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_customers" ON public.customers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_customers" ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER handle_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ── Accounts ──────────────────────────────────────────────────
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upstream_id TEXT UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  account_no TEXT NOT NULL,
  account_type TEXT,
  balance NUMERIC(14,2) DEFAULT 0,
  site_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.accounts IS 'Prepaid accounts linked to customers, synced from upstream.';

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_accounts" ON public.accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_accounts" ON public.accounts
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER handle_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- ── Meters ────────────────────────────────────────────────────
CREATE TABLE public.meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upstream_id TEXT UNIQUE,
  meter_sn TEXT NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  site_id TEXT,
  meter_type TEXT,
  communication_type TEXT,
  gateway_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  installed_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  last_read_value NUMERIC(14,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.meters IS 'Meter inventory synced from upstream system.';

ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_meters" ON public.meters
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_meters" ON public.meters
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER handle_meters_updated_at
  BEFORE UPDATE ON public.meters
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX idx_meters_meter_sn ON public.meters(meter_sn);
CREATE INDEX idx_meters_site_id ON public.meters(site_id);
CREATE INDEX idx_meters_gateway_id ON public.meters(gateway_id);

-- ── Meter Events ──────────────────────────────────────────────
CREATE TYPE public.meter_event_type AS ENUM (
  'alarm', 'tamper', 'power_failure', 'power_restore',
  'communication_failure', 'valve_open', 'valve_close',
  'firmware_update', 'config_change', 'other'
);

CREATE TABLE public.meter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID REFERENCES public.meters(id) ON DELETE SET NULL,
  meter_sn TEXT NOT NULL,
  event_type public.meter_event_type NOT NULL DEFAULT 'other',
  severity TEXT DEFAULT 'info',
  detail TEXT,
  event_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'upstream',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.meter_events IS 'Meter event log ingested from upstream event/alarm APIs.';

ALTER TABLE public.meter_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_meter_events" ON public.meter_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_meter_events" ON public.meter_events
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_meter_events_meter_sn ON public.meter_events(meter_sn);
CREATE INDEX idx_meter_events_event_ts ON public.meter_events(event_ts DESC);
CREATE INDEX idx_meter_events_event_type ON public.meter_events(event_type);

-- ── Remote Tasks ──────────────────────────────────────────────
CREATE TYPE public.remote_task_type AS ENUM (
  'read_meter', 'valve_control', 'set_parameter', 'firmware_upgrade',
  'key_change', 'set_tariff', 'clear_alarm', 'other'
);

CREATE TYPE public.remote_task_status AS ENUM (
  'pending', 'queued', 'sent', 'acknowledged', 'completed', 'failed', 'cancelled', 'timed_out'
);

CREATE TABLE public.remote_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID REFERENCES public.meters(id) ON DELETE SET NULL,
  meter_sn TEXT NOT NULL,
  task_type public.remote_task_type NOT NULL DEFAULT 'other',
  status public.remote_task_status NOT NULL DEFAULT 'pending',
  payload JSONB DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  upstream_task_id TEXT,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.remote_tasks IS 'Remote meter operations tracking with retry support.';

ALTER TABLE public.remote_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_remote_tasks" ON public.remote_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_remote_tasks" ON public.remote_tasks
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER handle_remote_tasks_updated_at
  BEFORE UPDATE ON public.remote_tasks
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX idx_remote_tasks_meter_sn ON public.remote_tasks(meter_sn);
CREATE INDEX idx_remote_tasks_status ON public.remote_tasks(status);
;
