
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username    text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  email       text,
  phone       text,
  address     text,
  remark      text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'App-native user profiles, one per auth.users row';

-- Auto-update updated_at
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- Index for lookups
CREATE INDEX idx_profiles_username ON public.profiles (username);
CREATE INDEX idx_profiles_email    ON public.profiles (email);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users read their own profile
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users update their own profile
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service-role can do anything (backend writes via service key)
CREATE POLICY profiles_service_all ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ── Auto-create profile on signup ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', NEW.email, NEW.id::text),
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.email,
      NEW.id::text
    ),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── Seed existing admin user profile ───────────────────────
INSERT INTO public.profiles (id, username, display_name, email)
SELECT
  id,
  COALESCE(raw_user_meta_data ->> 'username', email, id::text),
  COALESCE(
    raw_user_meta_data ->> 'display_name',
    raw_user_meta_data ->> 'full_name',
    email,
    id::text
  ),
  email
FROM auth.users
WHERE id = '6a4d8b1e-dd8e-4e19-ae37-925878d407ba'
ON CONFLICT (id) DO NOTHING;
;
