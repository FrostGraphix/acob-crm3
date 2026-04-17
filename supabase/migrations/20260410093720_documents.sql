
CREATE TABLE public.documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by   uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  category      public.document_category NOT NULL DEFAULT 'other',
  title         text NOT NULL,
  description   text,
  file_name     text NOT NULL,
  file_size     bigint,
  mime_type     text,
  storage_path  text NOT NULL,
  meter_id      text,
  customer_id   text,
  site_id       text,
  tags          text[] DEFAULT '{}',
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documents IS
  'Metadata for files stored in Supabase Storage. Covers meter docs, KYC, imports, exports, firmware, archives.';

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE INDEX idx_documents_uploaded_by ON public.documents (uploaded_by);
CREATE INDEX idx_documents_category    ON public.documents (category);
CREATE INDEX idx_documents_meter       ON public.documents (meter_id) WHERE meter_id IS NOT NULL;
CREATE INDEX idx_documents_customer    ON public.documents (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_documents_site        ON public.documents (site_id) WHERE site_id IS NOT NULL;
CREATE INDEX idx_documents_created     ON public.documents (created_at DESC);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Service-role full access
CREATE POLICY documents_service_all ON public.documents
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read all documents
CREATE POLICY documents_select_authenticated ON public.documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Authenticated users can upload (insert)
CREATE POLICY documents_insert_authenticated ON public.documents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
;
