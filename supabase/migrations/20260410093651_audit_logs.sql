
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action      public.audit_action NOT NULL,
  resource    text NOT NULL,
  resource_id text,
  detail      jsonb DEFAULT '{}'::jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for all sensitive app actions';

CREATE INDEX idx_audit_logs_user      ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_action    ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_resource  ON public.audit_logs (resource, resource_id);
CREATE INDEX idx_audit_logs_created   ON public.audit_logs (created_at DESC);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service-role can write
CREATE POLICY audit_logs_insert_service ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Admins can read all; others see their own
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR public.user_has_role('admin')
    OR auth.uid() = user_id
  );
;
