import type { DocumentUploadResponse } from "./api.ts";
import { createDocumentUploadUrl, request } from "./api.ts";
import type {
  VendorDashboardResponse,
  VendorCommissionSummaryResponse,
  VendorFundingRequestPayload,
  VendorFundingRequestRecord,
  VendorMeterSearchResult,
  VendorOnboardingPayload,
  VendorProfileResponse,
  VendorPurchaseDraft,
  VendorReceiptDetailResponse,
  VendorReceiptsQuery,
  VendorReceiptsResponse,
  VendorStatementQuery,
  VendorStatementResponse,
  VendorTransactionsQuery,
  VendorTransactionsResponse,
} from "../types/vendor-wallet.ts";
import type { WalletPurchaseRequestPayload, WalletPurchaseResponse } from "../../../common/types";

interface VendorRequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type RequestFn = <T>(path: string, options?: VendorRequestOptions) => Promise<T>;

interface VendorWalletServiceDependencies {
  createUploadUrl?: (payload: {
    fileName: string;
    title?: string;
    category?: string;
    siteId?: string;
    mimeType?: string;
    fileSize?: number;
  }) => Promise<DocumentUploadResponse>;
  requestFn?: RequestFn;
  storage?: StorageLike | null;
  uploadFile?: (signedUrl: string, file: File) => Promise<void>;
}

export interface UploadFundingProofOptions {
  siteId?: string;
  title?: string;
}

function getBrowserSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage ?? null;
}

function readJsonValue<T>(storage: StorageLike | null, key: string): T | null {
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function writeJsonValue(storage: StorageLike | null, key: string, value: unknown) {
  storage?.setItem(key, JSON.stringify(value));
}

async function uploadFileToSignedUrl(signedUrl: string, file: File) {
  const response = await fetch(signedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to upload funding proof.");
  }
}

function trimQueryValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeQuery(
  values: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> {
  return Object.entries(values).reduce<Record<string, string | number | boolean | undefined>>(
    (accumulator, [key, value]) => {
      if (value === undefined) {
        return accumulator;
      }

      if (typeof value === "string") {
        const trimmed = trimQueryValue(value);
        if (trimmed !== undefined) {
          accumulator[key] = trimmed;
        }
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    },
    {},
  );
}

const PURCHASE_DRAFT_STORAGE_KEY = "acob-vendor-wallet:purchase-draft";
const RECEIPT_CACHE_STORAGE_KEY = "acob-vendor-wallet:receipt-cache";

export function createVendorIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `wallet-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createVendorWalletService({
  createUploadUrl = createDocumentUploadUrl,
  requestFn = request as RequestFn,
  storage = getBrowserSessionStorage(),
  uploadFile = uploadFileToSignedUrl,
}: VendorWalletServiceDependencies = {}) {
  return {
    async loadDashboard() {
      return requestFn<VendorDashboardResponse>("/api/wallet/summary", { method: "GET" });
    },

    async searchMeters(searchTerm: string, limit = 8) {
      return requestFn<VendorMeterSearchResult[]>("/api/wallet/meters/search", {
        method: "GET",
        query: sanitizeQuery({
          q: searchTerm,
          limit,
        }),
      });
    },

    async loadTransactions(query: VendorTransactionsQuery = {}) {
      return requestFn<VendorTransactionsResponse>("/api/wallet/transactions", {
        method: "GET",
        query: sanitizeQuery({
          search: query.search,
          type: query.type && query.type !== "all" ? query.type : undefined,
          fromDate: query.fromDate,
          toDate: query.toDate,
          limit: query.limit,
        }),
      });
    },

    async loadCommissionSummary() {
      return requestFn<VendorCommissionSummaryResponse>("/api/wallet/commission/summary", {
        method: "GET",
      });
    },

    async loadReceipts(query: VendorReceiptsQuery = {}) {
      return requestFn<VendorReceiptsResponse>("/api/wallet/receipts", {
        method: "GET",
        query: sanitizeQuery({
          search: query.search,
          deliveryMethod:
            query.deliveryMethod && query.deliveryMethod !== "all"
              ? query.deliveryMethod
              : undefined,
          fromDate: query.fromDate,
          toDate: query.toDate,
          limit: query.limit,
        }),
      });
    },

    async loadReceipt(receiptId: string) {
      return requestFn<VendorReceiptDetailResponse>(
        `/api/wallet/receipt/${encodeURIComponent(receiptId)}`,
        { method: "GET" },
      );
    },

    async createFundingRequest(payload: VendorFundingRequestPayload) {
      return requestFn<VendorFundingRequestRecord>("/api/wallet/funding-request", {
        body: {
          ...payload,
          idempotencyKey: payload.idempotencyKey ?? createVendorIdempotencyKey(),
        } as unknown as Record<string, unknown>,
      });
    },

    async loadFundingRequest(requestId: string) {
      return requestFn<VendorFundingRequestRecord>(
        `/api/wallet/funding-request/${encodeURIComponent(requestId)}`,
        { method: "GET" },
      );
    },

    async submitFundingProof(
      fundingRequestId: string,
      payload: {
        fileName: string;
        documentId?: string | null;
        mimeType?: string;
        fileSize?: number;
        notes?: string;
      },
    ) {
      return requestFn<{ fundingRequest: VendorFundingRequestRecord; nextStatus: string }>(
        `/api/wallet/funding/${encodeURIComponent(fundingRequestId)}/upload-proof`,
        {
          body: {
            fileName: payload.fileName,
            documentId: payload.documentId ?? undefined,
            mimeType: payload.mimeType,
            fileSize: payload.fileSize,
            notes: payload.notes,
          },
        },
      );
    },

    async loadStatement(query: VendorStatementQuery) {
      return requestFn<VendorStatementResponse>("/api/wallet/statement", {
        method: "GET",
        query: sanitizeQuery(query as unknown as Record<string, string | number | boolean | undefined>),
      });
    },

    async loadProfile() {
      return requestFn<VendorProfileResponse>("/api/wallet/profile", { method: "GET" });
    },

    async submitOnboarding(payload: VendorOnboardingPayload) {
      return requestFn<{ vendor: VendorProfileResponse["vendor"]; readyForReview: boolean }>(
        `/api/vendor/${encodeURIComponent(payload.vendorId)}/onboarding`,
        {
          body: payload as unknown as Record<string, unknown>,
        },
      );
    },

    async purchaseRemoteSend(payload: WalletPurchaseRequestPayload) {
      return requestFn<WalletPurchaseResponse>("/api/wallet/purchase/remote-send", {
        body: {
          idempotency_key: payload.idempotencyKey,
          wallet_id: payload.walletId,
          meter_sn: payload.meterSn,
          customer_ref: payload.customerRef,
          amount: payload.amount,
          site_code: payload.siteCode,
        },
      });
    },

    async purchaseGenerateToken(payload: WalletPurchaseRequestPayload) {
      return requestFn<WalletPurchaseResponse>("/api/wallet/purchase/generate-token", {
        body: {
          idempotency_key: payload.idempotencyKey,
          wallet_id: payload.walletId,
          meter_sn: payload.meterSn,
          customer_ref: payload.customerRef,
          amount: payload.amount,
          site_code: payload.siteCode,
        },
      });
    },

    async uploadFundingProof(file: File, options: UploadFundingProofOptions = {}) {
      const uploadResponse = await createUploadUrl({
        fileName: file.name,
        title: options.title ?? file.name,
        category: "wallet-funding-proof",
        siteId: options.siteId,
        mimeType: file.type,
        fileSize: file.size,
      });

      await uploadFile(uploadResponse.upload.signedUrl, file);

      return {
        documentId: uploadResponse.document?.id ?? null,
        path: uploadResponse.upload.path,
      };
    },

    savePurchaseDraft(draft: VendorPurchaseDraft) {
      writeJsonValue(storage, PURCHASE_DRAFT_STORAGE_KEY, draft);
    },

    readPurchaseDraft() {
      return readJsonValue<VendorPurchaseDraft>(storage, PURCHASE_DRAFT_STORAGE_KEY);
    },

    clearPurchaseDraft() {
      storage?.removeItem(PURCHASE_DRAFT_STORAGE_KEY);
    },

    cacheReceiptDetail(detail: VendorReceiptDetailResponse) {
      writeJsonValue(storage, RECEIPT_CACHE_STORAGE_KEY, detail);
    },

    readCachedReceiptDetail() {
      return readJsonValue<VendorReceiptDetailResponse>(storage, RECEIPT_CACHE_STORAGE_KEY);
    },

    clearCachedReceiptDetail() {
      storage?.removeItem(RECEIPT_CACHE_STORAGE_KEY);
    },
  };
}

export const vendorWalletService = createVendorWalletService();
