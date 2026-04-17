import assert from "node:assert/strict";
import test from "node:test";
import { allPages, navigationSections } from "../../frontend/src/config/pageCatalog.ts";
import { filterPagesForUser } from "../../frontend/src/services/app-shell-state.ts";
import { createVendorWalletService } from "../../frontend/src/services/vendor-wallet.ts";

test("vendor wallet pages are present in the page catalog", () => {
  const paths = new Set(allPages.map((page) => page.path));

  assert.equal(paths.has("/vendor/dashboard"), true);
  assert.equal(paths.has("/vendor/buy"), true);
  assert.equal(paths.has("/vendor/commission"), true);
  assert.equal(paths.has("/vendor/transactions"), true);
  assert.equal(paths.has("/vendor/receipts"), true);
  assert.equal(paths.has("/vendor/topup"), true);
  assert.equal(paths.has("/vendor/statement"), true);
  assert.equal(paths.has("/vendor/profile"), true);
  assert.equal(paths.has("/wallet-admin/overview"), true);
  assert.equal(paths.has("/wallet-admin/vendor-onboarding"), true);
  assert.equal(paths.has("/wallet-admin/funding-pending"), true);
  assert.equal(paths.has("/wallet-admin/wallet-kpis"), true);
  assert.equal(paths.has("/wallet-admin/commission-rules"), true);
  assert.equal(paths.has("/wallet-admin/settlement-batches"), true);
  assert.equal(paths.has("/wallet-admin/reconciliation"), true);
  assert.equal(paths.has("/wallet-admin/exceptions"), true);
  assert.equal(paths.has("/wallet-admin/settlement-report"), true);

  const sectionKeys = new Set(navigationSections.map((section) => section.key));
  assert.equal(sectionKeys.has("vendor-wallet"), true);
  assert.equal(sectionKeys.has("vendor-buy"), true);
  assert.equal(sectionKeys.has("wallet-admin-home"), true);
  assert.equal(sectionKeys.has("wallet-admin-funding"), true);
});

test("vendor onboarding queue page is available to finance and admin users", () => {
  const financePaths = new Set(
    filterPagesForUser(allPages, {
      username: "finance",
      displayName: "Finance User",
      role: "Finance",
      appRole: "finance",
    }).map((page) => page.path),
  );
  const adminPaths = new Set(
    filterPagesForUser(allPages, {
      username: "admin",
      displayName: "Admin User",
      role: "Administrator",
      appRole: "admin",
    }).map((page) => page.path),
  );

  assert.equal(financePaths.has("/wallet-admin/vendor-onboarding"), true);
  assert.equal(adminPaths.has("/wallet-admin/vendor-onboarding"), true);
  assert.equal(financePaths.has("/wallet-admin/funding-pending"), true);
  assert.equal(adminPaths.has("/wallet-admin/funding-pending"), true);
  assert.equal(financePaths.has("/wallet-admin/wallet-kpis"), true);
  assert.equal(adminPaths.has("/wallet-admin/wallet-kpis"), true);
  assert.equal(financePaths.has("/wallet-admin/commission-rules"), true);
  assert.equal(adminPaths.has("/wallet-admin/commission-rules"), true);
  assert.equal(financePaths.has("/wallet-admin/settlement-batches"), true);
  assert.equal(adminPaths.has("/wallet-admin/settlement-batches"), true);
  assert.equal(financePaths.has("/wallet-admin/reconciliation"), true);
  assert.equal(adminPaths.has("/wallet-admin/reconciliation"), true);
  assert.equal(financePaths.has("/wallet-admin/exceptions"), true);
  assert.equal(adminPaths.has("/wallet-admin/exceptions"), true);
  assert.equal(financePaths.has("/wallet-admin/settlement-report"), true);
  assert.equal(adminPaths.has("/wallet-admin/settlement-report"), true);
});

test("vendor wallet service loads commission summary from the wallet route", async () => {
  const calls: Array<{ path: string; options?: { method?: string } }> = [];
  const service = createVendorWalletService({
    requestFn: async (path, options) => {
      calls.push({ path, options: { method: options?.method } });
      return {
        rule: {
          vendorId: "vendor-1",
          rate: 0,
          overrideSource: "default",
          createdAt: "2026-04-16T10:00:00.000Z",
          updatedAt: "2026-04-16T10:00:00.000Z",
        },
        totalAccrued: 0,
        totalSettled: 0,
        totalOutstanding: 0,
        accrualCount: 0,
        settlementCount: 0,
        latestAccruedAt: null,
        latestSettledAt: null,
        history: {
          rows: [],
          total: 0,
        },
      };
    },
    storage: null,
  });

  await service.loadCommissionSummary();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.path, "/api/wallet/commission/summary");
  assert.equal(calls[0]?.options?.method, "GET");
});

test("vendor wallet service maps purchase payloads to backend request fields", async () => {
  const calls: Array<{ path: string; options?: { body?: Record<string, unknown> } }> = [];
  const service = createVendorWalletService({
    requestFn: async (path, options) => {
      calls.push({ path, options: { body: options?.body } });
      return {
        purchaseId: "purchase-1",
        walletId: "wallet-1",
        status: "successful",
        deliveryMethod: "token_generate",
        receiptId: "receipt-1",
        receiptNumber: "RCP-20260414-100001",
        message: "ok",
      };
    },
    storage: null,
  });

  await service.purchaseGenerateToken({
    idempotencyKey: "idem-1",
    walletId: "wallet-1",
    meterSn: "MTR-001",
    customerRef: "CUST-001",
    amount: 5000,
    siteCode: "SITE_001",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.path, "/api/wallet/purchase/generate-token");
  assert.deepEqual(calls[0]?.options?.body, {
    idempotency_key: "idem-1",
    wallet_id: "wallet-1",
    meter_sn: "MTR-001",
    customer_ref: "CUST-001",
    amount: 5000,
    site_code: "SITE_001",
  });
});

test("vendor wallet service submits onboarding payload to the vendor onboarding route", async () => {
  const calls: Array<{ path: string; options?: { body?: Record<string, unknown> } }> = [];
  const service = createVendorWalletService({
    requestFn: async (path, options) => {
      calls.push({ path, options: { body: options?.body } });
      return {
        vendor: {
          vendorCode: "ACME001",
        },
        readyForReview: true,
      };
    },
    storage: null,
  });

  await service.submitOnboarding({
    vendorId: "VENDOR_ACME",
    vendorCode: "ACME001",
    businessName: "Acme Retailing Ltd",
    legalName: "Acme Retailing Limited",
    displayName: "Acme Retailing",
    contactName: "Amina Yusuf",
    contactEmail: "amina@acme.test",
    contactPhone: "08010000000",
    businessAddress: "12 Marina Road",
    registrationNumber: "RC-1001",
    taxId: "TIN-2002",
    bankName: "ACOB Bank",
    bankAccountName: "Acme Retailing Ltd",
    bankAccountNumber: "0123456789",
    bankSortCode: "000123",
    kycDocumentCount: 2,
    onboardingNotes: "Ready for review",
    submitForReview: true,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.path, "/api/vendor/VENDOR_ACME/onboarding");
  assert.equal(calls[0]?.options?.body?.submitForReview, true);
  assert.equal(calls[0]?.options?.body?.bankSortCode, "000123");
});

test("vendor wallet service uploads funding proof with file metadata and submits proof to the wallet route", async () => {
  const uploadPayloads: Array<Record<string, unknown>> = [];
  const requestCalls: Array<{ path: string; options?: { body?: Record<string, unknown> } }> = [];
  const service = createVendorWalletService({
    createUploadUrl: async (payload) => {
      uploadPayloads.push(payload as unknown as Record<string, unknown>);
      return {
        upload: {
          path: "documents/site_001/proof.pdf",
          signedUrl: "https://storage.test/upload",
          token: "signed-token",
        },
        document: {
          id: "doc-proof-1",
          storage_path: "documents/site_001/proof.pdf",
        },
      };
    },
    uploadFile: async () => undefined,
    requestFn: async (path, options) => {
      requestCalls.push({ path, options: { body: options?.body } });
      return {
        fundingRequest: {
          id: "funding-1",
          walletId: "wallet-1",
          vendorId: "vendor-1",
          amount: 5000,
          channel: "bank_transfer",
          reference: "FND-20260416-000001",
          status: "under_review",
          proofDocumentId: "doc-proof-1",
          createdAt: "2026-04-16T10:00:00.000Z",
          updatedAt: "2026-04-16T10:01:00.000Z",
        },
        nextStatus: "under_review",
      };
    },
    storage: null,
  });

  const file = new File(["proof"], "proof.pdf", { type: "application/pdf" });
  const uploadResult = await service.uploadFundingProof(file, { siteId: "SITE_001" });
  assert.equal(uploadResult.documentId, "doc-proof-1");
  assert.equal(uploadPayloads.length, 1);
  assert.equal(uploadPayloads[0]?.mimeType, "application/pdf");
  assert.equal(typeof uploadPayloads[0]?.fileSize, "number");

  await service.submitFundingProof("funding-1", {
    fileName: "proof.pdf",
    documentId: "doc-proof-1",
    mimeType: "application/pdf",
    fileSize: 5,
  });

  assert.equal(requestCalls.length, 1);
  assert.equal(requestCalls[0]?.path, "/api/wallet/funding/funding-1/upload-proof");
  assert.deepEqual(requestCalls[0]?.options?.body, {
    fileName: "proof.pdf",
    documentId: "doc-proof-1",
    mimeType: "application/pdf",
    fileSize: 5,
    notes: undefined,
  });
});
