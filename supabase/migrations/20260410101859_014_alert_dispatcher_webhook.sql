CREATE OR REPLACE FUNCTION public.notify_alert_dispatcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- We only want to notify on critical alerts
  IF NEW.severity = 'critical' THEN
    PERFORM extensions.net.http_post(
      url:='https://qpoipyqgrjsjdvfqmxok.supabase.co/functions/v1/alert-dispatcher',
      body:=jsonb_build_object(
        'type', 'INSERT',
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', to_jsonb(NEW)
      ),
      headers:='{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_alert_dispatcher ON public.notifications;

CREATE TRIGGER tr_notify_alert_dispatcher
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_alert_dispatcher();
;
