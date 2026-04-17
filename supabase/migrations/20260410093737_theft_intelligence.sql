
CREATE TABLE public.theft_signals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id      text NOT NULL,
  customer_name text,
  severity      public.theft_signal_severity NOT NULL DEFAULT 'watch',
  score         integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  signal_types  text[] NOT NULL DEFAULT '{}',
  title         text NOT NULL,
  message       text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  date_bucket   date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.theft_signals IS 'Individual theft risk signals detected by the analysis engine';

CREATE TRIGGER theft_signals_updated_at
  BEFORE UPDATE ON public.theft_signals
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE INDEX idx_theft_signals_meter    ON public.theft_signals (meter_id);
CREATE INDEX idx_theft_signals_severity ON public.theft_signals (severity) WHERE status = 'active';
CREATE INDEX idx_theft_signals_created  ON public.theft_signals (created_at DESC);

-- ── Theft cases ────────────────────────────────────────────
CREATE TABLE public.theft_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id      text NOT NULL,
  customer_name text,
  severity      public.theft_signal_severity NOT NULL DEFAULT 'watch',
  score         integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  status        public.theft_case_status NOT NULL DEFAULT 'new',
  signal_ids    uuid[] NOT NULL DEFAULT '{}',
  owner         text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);

COMMENT ON TABLE public.theft_cases IS 'Aggregated theft investigation cases linking multiple signals';

CREATE TRIGGER theft_cases_updated_at
  BEFORE UPDATE ON public.theft_cases
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE INDEX idx_theft_cases_meter  ON public.theft_cases (meter_id);
CREATE INDEX idx_theft_cases_status ON public.theft_cases (status) WHERE status NOT IN ('closed', 'false_positive');
CREATE INDEX idx_theft_cases_owner  ON public.theft_cases (owner) WHERE owner IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.theft_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theft_cases   ENABLE ROW LEVEL SECURITY;

-- Service-role manages all
CREATE POLICY theft_signals_service ON public.theft_signals
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY theft_cases_service ON public.theft_cases
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY theft_signals_select ON public.theft_signals
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY theft_cases_select ON public.theft_cases
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Ops and admin can update cases
CREATE POLICY theft_cases_update ON public.theft_cases
  FOR UPDATE USING (
    public.user_has_role('admin') OR public.user_has_role('ops')
  );
;
