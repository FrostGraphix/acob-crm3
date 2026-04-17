CREATE TABLE public.system_leases (
  key         text PRIMARY KEY,
  instance_id text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_leases IS 'Distributed locking for Node.js schedulers (replaces Redis PSETEX).';

-- Function to safely acquire or renew a lease
CREATE OR REPLACE FUNCTION public.try_acquire_lease(
  p_key text, 
  p_instance_id text, 
  p_ttl_ms integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := now();
  v_expires timestamptz := v_now + (p_ttl_ms || ' milliseconds')::interval;
  v_updated boolean := false;
BEGIN
  -- Attempt to insert if not exists or if expired
  INSERT INTO public.system_leases (key, instance_id, expires_at)
  VALUES (p_key, p_instance_id, v_expires)
  ON CONFLICT (key) DO UPDATE
  SET instance_id = EXCLUDED.instance_id,
      expires_at = EXCLUDED.expires_at,
      updated_at = v_now
  WHERE public.system_leases.instance_id = p_instance_id 
     OR public.system_leases.expires_at < v_now;

  -- Check if we hold the lease
  SELECT (instance_id = p_instance_id) INTO v_updated
  FROM public.system_leases
  WHERE key = p_key;

  RETURN COALESCE(v_updated, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_lease(p_key text, p_instance_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.system_leases 
  WHERE key = p_key AND instance_id = p_instance_id;
END;
$$;

-- RLS
ALTER TABLE public.system_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_leases_service ON public.system_leases
  FOR ALL USING (auth.role() = 'service_role');
;
