import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  createDocumentDownloadUrl,
  createDocumentUploadUrl,
  listDocuments,
  type DocumentRecord,
} from "../services/api";

const CATEGORY_OPTIONS = [
  { label: "Other", value: "other" },
  { label: "KYC", value: "kyc" },
  { label: "Installation", value: "installation" },
  { label: "Report", value: "report" },
  { label: "Import", value: "import" },
  { label: "Support", value: "support" },
] as const;

interface DocumentFilterState {
  category: string;
  siteId: string;
  meterId: string;
  customerId: string;
}

interface UploadFormState {
  title: string;
  category: string;
  siteId: string;
  meterId: string;
  customerId: string;
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function readMetadataString(document: DocumentRecord, key: string) {
  const value = document.metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function createEmptyFilters(): DocumentFilterState {
  return {
    category: "",
    siteId: "",
    meterId: "",
    customerId: "",
  };
}

function createUploadForm(): UploadFormState {
  return {
    title: "",
    category: "other",
    siteId: "",
    meterId: "",
    customerId: "",
  };
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [filters, setFilters] = useState<DocumentFilterState>(createEmptyFilters());
  const [uploadForm, setUploadForm] = useState<UploadFormState>(createUploadForm());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);

  const hydrate = async (nextFilters: DocumentFilterState = filters) => {
    setLoading(true);
    try {
      const rows = await listDocuments({
        category: nextFilters.category || undefined,
        siteId: nextFilters.siteId || undefined,
        meterId: nextFilters.meterId || undefined,
        customerId: nextFilters.customerId || undefined,
      });
      setDocuments(rows);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    await hydrate(filters);
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setFeedback(null);

    try {
      const uploadPayload = await createDocumentUploadUrl({
        fileName: selectedFile.name,
        title: uploadForm.title.trim() || selectedFile.name,
        category: uploadForm.category,
        siteId: uploadForm.siteId.trim() || undefined,
        meterId: uploadForm.meterId.trim() || undefined,
        customerId: uploadForm.customerId.trim() || undefined,
      });

      const uploadResponse = await fetch(uploadPayload.upload.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      setSelectedFile(null);
      setUploadForm(createUploadForm());
      setFeedback(`Uploaded ${selectedFile.name} successfully.`);
      await hydrate();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (document: DocumentRecord) => {
    setActiveDownloadId(document.id);
    setError(null);
    setFeedback(null);

    try {
      const result = await createDocumentDownloadUrl({
        storagePath: document.storage_path,
      });
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to open document");
    } finally {
      setActiveDownloadId(null);
    }
  };

  return (
    <section className="documents-page page-stack">
      <header className="documents-hero">
        <div>
          <p className="eyebrow">Supabase Storage</p>
          <h1 className="documents-title">Document Management</h1>
          <p className="documents-copy">
            Keep KYC files, meter paperwork, reports, and imports in one searchable, signed-access workspace.
          </p>
        </div>
        <button className="button button-ghost" onClick={() => void hydrate()} type="button">
          Refresh
        </button>
      </header>

      {feedback ? <p className="status-banner">{feedback}</p> : null}
      {error ? <p className="status-banner status-banner-error">{error}</p> : null}

      <div className="documents-layout">
        <form className="toolbar-panel documents-panel documents-upload-form" onSubmit={handleUpload}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Upload</p>
              <h2>Add Document</h2>
            </div>
          </div>

          <label className="field documents-field-span">
            <span>File</span>
            <input
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setSelectedFile(event.target.files?.[0] ?? null);
              }}
              type="file"
            />
          </label>

          <label className="field">
            <span>Title</span>
            <input
              onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Installation report, KYC card, service note..."
              type="text"
              value={uploadForm.title}
            />
          </label>

          <label className="field">
            <span>Category</span>
            <select
              onChange={(event) => setUploadForm((current) => ({ ...current, category: event.target.value }))}
              value={uploadForm.category}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Site</span>
            <input
              onChange={(event) => setUploadForm((current) => ({ ...current, siteId: event.target.value }))}
              placeholder="Musha, Ogufa, Umaisha..."
              type="text"
              value={uploadForm.siteId}
            />
          </label>

          <label className="field">
            <span>Meter Id</span>
            <input
              onChange={(event) => setUploadForm((current) => ({ ...current, meterId: event.target.value }))}
              placeholder="Optional linked meter"
              type="text"
              value={uploadForm.meterId}
            />
          </label>

          <label className="field">
            <span>Customer Id</span>
            <input
              onChange={(event) => setUploadForm((current) => ({ ...current, customerId: event.target.value }))}
              placeholder="Optional linked customer"
              type="text"
              value={uploadForm.customerId}
            />
          </label>

          <div className="documents-actions">
            <button className="button button-primary" disabled={uploading} type="submit">
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>

        <form className="toolbar-panel documents-panel documents-filter-form" onSubmit={handleFilterSubmit}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2>Filter Library</h2>
            </div>
          </div>

          <label className="field">
            <span>Category</span>
            <select
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              value={filters.category}
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Site</span>
            <input
              onChange={(event) => setFilters((current) => ({ ...current, siteId: event.target.value }))}
              placeholder="Filter by site"
              type="text"
              value={filters.siteId}
            />
          </label>

          <label className="field">
            <span>Meter Id</span>
            <input
              onChange={(event) => setFilters((current) => ({ ...current, meterId: event.target.value }))}
              placeholder="Filter by meter"
              type="text"
              value={filters.meterId}
            />
          </label>

          <label className="field">
            <span>Customer Id</span>
            <input
              onChange={(event) => setFilters((current) => ({ ...current, customerId: event.target.value }))}
              placeholder="Filter by customer"
              type="text"
              value={filters.customerId}
            />
          </label>

          <div className="documents-actions">
            <button className="button button-outline" type="submit">
              Apply Filters
            </button>
            <button
              className="button button-ghost"
              onClick={() => {
                const next = createEmptyFilters();
                setFilters(next);
                void hydrate(next);
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      <section className="toolbar-panel documents-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Library</p>
            <h2>Stored Documents</h2>
          </div>
          <strong>{documents.length} files</strong>
        </div>

        {loading ? <div className="documents-empty-state">Loading documents...</div> : null}
        {!loading && documents.length === 0 ? (
          <div className="documents-empty-state">
            No documents match the current filters yet.
          </div>
        ) : null}

        {!loading && documents.length > 0 ? (
          <div className="documents-table-shell">
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Site</th>
                  <th>Linked To</th>
                  <th>Uploaded</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <strong>{readMetadataString(document, "title") ?? document.file_name}</strong>
                      <span className="documents-subtext">{document.file_name}</span>
                    </td>
                    <td>{readMetadataString(document, "category") ?? "other"}</td>
                    <td>{document.site_code ?? "general"}</td>
                    <td>
                      {document.entity_type && document.entity_id
                        ? `${document.entity_type}: ${document.entity_id}`
                        : "Unlinked"}
                    </td>
                    <td>{formatTimestamp(document.created_at)}</td>
                    <td className="documents-table-actions">
                      <button
                        className="button button-outline"
                        disabled={activeDownloadId === document.id}
                        onClick={() => void handleDownload(document)}
                        type="button"
                      >
                        {activeDownloadId === document.id ? "Opening..." : "Open"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}
