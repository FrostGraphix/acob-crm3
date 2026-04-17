
-- Enable moddatetime for auto-updating updated_at columns
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Enable pg_trgm for future full-text / trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- ── Enum types ─────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM (
  'admin', 'ops', 'finance', 'field_agent', 'readonly'
);
CREATE TYPE public.notification_severity AS ENUM (
  'info', 'warning', 'critical'
);
CREATE TYPE public.document_category AS ENUM (
  'meter_document', 'kyc', 'import_spreadsheet',
  'export_report', 'firmware', 'archive', 'other'
);
CREATE TYPE public.theft_signal_severity AS ENUM (
  'watch', 'suspect', 'critical'
);
CREATE TYPE public.theft_case_status AS ENUM (
  'new', 'active', 'investigating',
  'confirmed_theft', 'false_positive', 'closed'
);
CREATE TYPE public.import_job_status AS ENUM (
  'pending', 'processing', 'completed', 'failed', 'cancelled'
);
CREATE TYPE public.audit_action AS ENUM (
  'login', 'logout', 'upload', 'download', 'create', 'update', 'delete',
  'remote_command', 'import', 'export', 'engine_run', 'role_change'
);
;
