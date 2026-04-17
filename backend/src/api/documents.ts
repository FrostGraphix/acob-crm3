import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendEnvelope } from "../services/response.js";
import {
  createSupabaseSignedUploadUrl,
  createSupabaseSignedDownloadUrl,
  isSupabaseStorageEnabled,
} from "../services/supabase.js";
import {
  insertDocument,
  listDocuments,
  isSupabaseDbEnabled,
  type DbDocument,
} from "../services/supabase-db.js";

export const documentRouter = Router();

const STRICT_DOCUMENT_CATEGORIES = new Set(["wallet-funding-proof", "vendor-kyc"]);
const ALLOWED_STRICT_DOCUMENT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_STRICT_DOCUMENT_BYTES = 5 * 1024 * 1024;

documentRouter.get("/", async (req, res) => {
  if (!isSupabaseDbEnabled()) {
    sendEnvelope(res, 503, null, "Document service unavailable", 1);
    return;
  }

  const { category, meterId, customerId, siteId, limit } = req.query as Record<string, string>;

  try {
    const documents = await listDocuments({
      category: category || undefined,
      meterId: meterId || undefined,
      customerId: customerId || undefined,
      siteId: siteId || undefined,
      limit: limit ? Number(limit) : undefined,
    });
    sendEnvelope(res, 200, documents, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list documents";
    sendEnvelope(res, 500, null, message, 1);
  }
});

documentRouter.post("/upload-url", async (req, res) => {
  if (!isSupabaseStorageEnabled()) {
    sendEnvelope(res, 503, null, "Storage service unavailable", 1);
    return;
  }

  const { fileName, category, title, meterId, customerId, siteId, mimeType, fileSize } = req.body as {
    fileName?: string;
    category?: string;
    title?: string;
    meterId?: string;
    customerId?: string;
    siteId?: string;
    mimeType?: string;
    fileSize?: number;
  };

  if (!fileName || typeof fileName !== "string" || fileName.trim().length === 0) {
    sendEnvelope(res, 400, null, "fileName is required", 1);
    return;
  }

  const normalizedCategory = typeof category === "string" && category.trim().length > 0 ? category.trim() : "other";
  const normalizedMimeType =
    typeof mimeType === "string" && mimeType.trim().length > 0 ? mimeType.trim().toLowerCase() : null;
  const normalizedFileSize = typeof fileSize === "number" && Number.isFinite(fileSize) ? fileSize : null;

  if (STRICT_DOCUMENT_CATEGORIES.has(normalizedCategory)) {
    if (
      !normalizedMimeType ||
      !ALLOWED_STRICT_DOCUMENT_MIME_TYPES.has(normalizedMimeType) ||
      normalizedFileSize === null ||
      normalizedFileSize <= 0 ||
      normalizedFileSize > MAX_STRICT_DOCUMENT_BYTES
    ) {
      sendEnvelope(
        res,
        400,
        null,
        normalizedCategory === "wallet-funding-proof" ? "INVALID_PROOF_FORMAT" : "INVALID_DOCUMENT_FORMAT",
        1,
      );
      return;
    }
  }

  try {
    const sanitizedName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    const normalizedSiteId =
      typeof siteId === "string" && siteId.trim().length > 0
        ? siteId.trim().toLowerCase()
        : "general";
    const storagePath = `documents/${normalizedSiteId}/${Date.now()}_${sanitizedName}`;

    const uploadResult = await createSupabaseSignedUploadUrl(storagePath);

    // Pre-create the document metadata record
    if (isSupabaseDbEnabled()) {
      const authRequest = req as AuthenticatedRequest;
      const docMeta: DbDocument = {
        uploaded_by: authRequest.authSession?.user.id ?? null,
        title: title || sanitizedName,
        file_name: sanitizedName,
        file_size: normalizedFileSize,
        mime_type: normalizedMimeType,
        storage_path: storagePath,
        category: normalizedCategory,
        meter_id: meterId || null,
        customer_id: customerId || null,
        site_id: siteId || null,
      };

      const doc = await insertDocument(docMeta);

      sendEnvelope(res, 200, {
        upload: uploadResult,
        document: doc,
      }, "success");
    } else {
      sendEnvelope(res, 200, { upload: uploadResult }, "success");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create upload URL";
    sendEnvelope(res, 500, null, message, 1);
  }
});

documentRouter.post("/download-url", async (req, res) => {
  if (!isSupabaseStorageEnabled()) {
    sendEnvelope(res, 503, null, "Storage service unavailable", 1);
    return;
  }

  const { storagePath, expiresIn } = req.body as {
    storagePath?: string;
    expiresIn?: number;
  };

  if (!storagePath || typeof storagePath !== "string" || storagePath.trim().length === 0) {
    sendEnvelope(res, 400, null, "storagePath is required", 1);
    return;
  }

  try {
    const downloadUrl = await createSupabaseSignedDownloadUrl(
      storagePath.trim(),
      typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 3600,
    );
    sendEnvelope(res, 200, downloadUrl, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create download URL";
    sendEnvelope(res, 500, null, message, 1);
  }
});
