
CREATE TABLE public.token_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_sn        text NOT NULL,
  site_id         text NOT NULL,
  customer_name   text,
  account_no      text,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  kwh             numeric(14,4) NOT NULL DEFAULT 0,
  tariff_rate     text DEFAULT 'Standard',
  transaction_ts  timestamptz NOT NULL,
  ingested_at     timestamptz NOT NULL DEFAULT now(),
  upstream_id     text,
  UNIQUE (meter_sn, transaction_ts, amount)
);

COMMENT ON TABLE public.token_transactions IS
  'Normalized token transaction records ingested from upstream. Deduped on (meter_sn, transaction_ts, amount).';

CREATE INDEX idx_token_tx_meter     ON public.token_transactions (meter_sn);
CREATE INDEX idx_token_tx_site      ON public.token_transactions (site_id);
CREATE INDEX idx_token_tx_ts        ON public.token_transactions (transaction_ts DESC);
CREATE INDEX idx_token_tx_ingested  ON public.token_transactions (ingested_at DESC);

-- For dashboard date-range queries
CREATE INDEX idx_token_tx_site_ts
  ON public.token_transactions (site_id, transaction_ts DESC);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- Service-role writes (backend ingestion)
CREATE POLICY token_tx_service ON public.token_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users read
CREATE POLICY token_tx_select ON public.token_transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);
;
