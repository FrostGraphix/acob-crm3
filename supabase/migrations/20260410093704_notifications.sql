
CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  severity    public.notification_severity NOT NULL DEFAULT 'info',
  title       text NOT NULL,
  message     text NOT NULL,
  meter_id    text,
  source      text NOT NULL DEFAULT 'system',
  read        boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS
  'Persistent notifications (analysis alerts, system events). user_id NULL means broadcast to all users.';

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC)
  WHERE NOT read;
CREATE INDEX idx_notifications_meter
  ON public.notifications (meter_id)
  WHERE meter_id IS NOT NULL;
CREATE INDEX idx_notifications_created
  ON public.notifications (created_at DESC);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Service-role inserts (backend analysis engine)
CREATE POLICY notifications_insert_service ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Users see their own + broadcasts (user_id IS NULL)
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR auth.uid() = user_id
    OR user_id IS NULL
  );

-- Users can mark their own as read
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR auth.uid() = user_id
    OR user_id IS NULL
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.uid() = user_id
    OR user_id IS NULL
  );

-- ── Enable Realtime ────────────────────────────────────────
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
;
