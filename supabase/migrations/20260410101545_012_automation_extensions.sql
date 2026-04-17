-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- Enable the pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Drop the old job if it exists to be safe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM ext.cron.unschedule('refresh_token_views_nightly');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignore if function doesn't exist
END $$;

-- Schedule the materialized view refresh every night at UTC 1:00 AM.
SELECT cron.schedule('refresh_token_views_nightly', '0 1 * * *', 'SELECT public.refresh_token_views()');
;
