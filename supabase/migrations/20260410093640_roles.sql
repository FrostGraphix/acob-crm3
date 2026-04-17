
CREATE TABLE public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        public.app_role NOT NULL UNIQUE,
  label       text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles IS 'Static role definitions for ACOB CRM access control';

CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  granted_by  uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

COMMENT ON TABLE public.user_roles IS 'Many-to-many mapping of users to roles';

CREATE INDEX idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles (role_id);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Everyone can read roles
CREATE POLICY roles_select_all ON public.roles
  FOR SELECT USING (true);

-- Service-role manages roles
CREATE POLICY roles_service_all ON public.roles
  FOR ALL USING (auth.role() = 'service_role');

-- Users can see their own role assignments
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Service-role manages user_roles
CREATE POLICY user_roles_service_all ON public.user_roles
  FOR ALL USING (auth.role() = 'service_role');

-- ── Helper: check if current user has a role ───────────────
CREATE OR REPLACE FUNCTION public.user_has_role(check_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = check_role
  );
$$;

-- ── Seed default roles ─────────────────────────────────────
INSERT INTO public.roles (name, label, description) VALUES
  ('admin',       'Administrator', 'Full system access'),
  ('ops',         'Operations',    'Meter operations and field management'),
  ('finance',     'Finance',       'Token transactions, revenue reports, reconciliation'),
  ('field_agent', 'Field Agent',   'On-site meter reads, inspections, document uploads'),
  ('readonly',    'Read Only',     'View-only dashboard access');

-- ── Grant admin role to existing user ──────────────────────
INSERT INTO public.user_roles (user_id, role_id)
SELECT
  '6a4d8b1e-dd8e-4e19-ae37-925878d407ba'::uuid,
  r.id
FROM public.roles r
WHERE r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
;
