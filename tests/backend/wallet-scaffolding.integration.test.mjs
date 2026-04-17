import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import jwt from "../../backend/node_modules/jsonwebtoken/index.js";

let server;
let baseUrl;
let resetWalletDomainState;
let resetWalletPersistenceMirrorState;

test.before(async () => {
  process.env.NODE_ENV = "test";
  process.env.SESSION_STORE_MODE = "memory";
  process.env.SUPABASE_AUTH_ENABLED = "false";
  process.env.SUPABASE_STORAGE_ENABLED = "false";
  process.env.ENABLE_ANALYSIS_ENGINE = "false";
  process.env.ENABLE_SITE_CONSUMPTION_ENGINE = "false";
  process.env.UPSTREAM_PASSWORD = "";

  const [{ createApp }, walletStoreModule, walletPersistenceModule] = await Promise.all([
    import("../../backend/dist/backend/src/app.js"),
    import("../../backend/dist/backend/src/services/wallet-domain-store.js"),
    import("../../backend/dist/backend/src/services/wallet-persistence.js"),
  ]);
  resetWalletDomainState = walletStoreModule.resetWalletDomainState;
  resetWalletPersistenceMirrorState = walletPersistenceModule.resetWalletPersistenceMirrorState;

  const app = createApp();
  server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve wallet scaffold test server port");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.beforeEach(() => {
  resetWalletDomainState();
  resetWalletPersistenceMirrorState();
});

test.after(async () => {
  if (server) {
    server.close();
    await once(server, "close");
  }
});

async function createAuthCookieHeader({
  username,
  displayName,
  role,
  id,
  vendor_id,
  site_code,
  app_role,
}) {
  const [{ env }, { createSession }, { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME }] = await Promise.all([
    import("../../backend/dist/backend/src/services/env.js"),
    import("../../backend/dist/backend/src/services/session-store.js"),
    import("../../backend/dist/backend/src/services/auth-cookie.js"),
  ]);

  const sessionId = `${username}-session`;
  const csrfToken = `${username}-csrf`;
  await createSession(sessionId, { csrfToken });

  const token = jwt.sign(
    {
      user: {
        id,
        username,
        displayName,
        role,
        vendor_id,
        site_code,
        app_role,
      },
      sessionId,
      issuedAt: Date.now(),
    },
    env.jwtSecret,
  );

  return {
    cookie: `${SESSION_COOKIE_NAME}=${token}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
    csrfToken,
  };
}

async function postJson(url, auth, body, extraHeaders = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      cookie: auth.cookie,
      "content-type": "application/json",
      "x-csrf-token": auth.csrfToken,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

test("wallet scaffold routes cover checklist, onboarding, funding, purchase branching, and receipts", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin",
    displayName: "ACOB Admin",
    role: "Administrator",
    id: "admin-1",
    app_role: "admin",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.acme",
    displayName: "Acme Vendor",
    role: "Vendor User",
    id: "vendor-user-1",
    vendor_id: "VENDOR_ACME",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  const checklistResponse = await fetch(`${baseUrl}/api/vendor/checklist`, {
    headers: {
      cookie: adminAuth.cookie,
    },
  });
  assert.equal(checklistResponse.status, 200);
  const checklistPayload = await checklistResponse.json();
  assert.equal(checklistPayload.result.phases.length, 8);
  assert.equal(checklistPayload.result.phases[0].key, "phase-0");

  const inviteResponse = await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_ACME",
    username: "vendor.acme",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  assert.equal(inviteResponse.status, 201);

  const profileResponse = await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_ACME",
    vendorCode: "ACME001",
    businessName: "Acme Retailing Ltd",
    legalName: "Acme Retailing Limited",
    displayName: "Acme Retailing",
    contactName: "Amina Yusuf",
    contactEmail: "amina@acme.test",
    contactPhone: "08010000010",
    businessAddress: "12 Marina Road",
    registrationNumber: "RC-1001",
    taxId: "TIN-2002",
    bankName: "ACOB Bank",
    bankAccountName: "Acme Retailing Ltd",
    bankAccountNumber: "0123456789",
    bankSortCode: "000123",
    kycDocumentCount: 2,
    siteCode: "SITE_001",
    kycCompleted: true,
  });
  assert.equal(profileResponse.status, 201);

  const approveResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_ACME/approve`, adminAuth, {});
  assert.equal(approveResponse.status, 200);
  const approvePayload = await approveResponse.json();
  const walletId = approvePayload.result.wallet.id;

  const fundingRequestResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 5000,
    channel: "bank_transfer",
    idempotency_key: "funding-acme-001",
  });
  assert.equal(fundingRequestResponse.status, 201);
  const fundingRequestPayload = await fundingRequestResponse.json();
  const fundingRequestId = fundingRequestPayload.result.fundingRequest.id;

  const proofResponse = await postJson(
    `${baseUrl}/api/wallet/funding/${fundingRequestId}/upload-proof`,
    vendorAuth,
    {
      fileName: "proof-slip.pdf",
      mimeType: "application/pdf",
      fileSize: 2048,
    },
  );
  assert.equal(proofResponse.status, 200);

  const fundingApproveResponse = await postJson(
    `${baseUrl}/api/wallet/funding/${fundingRequestId}/approve`,
    adminAuth,
    {},
  );
  assert.equal(fundingApproveResponse.status, 200);

  const overviewResponse = await fetch(`${baseUrl}/api/wallet/overview`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  assert.equal(overviewResponse.status, 200);
  const overviewPayload = await overviewResponse.json();
  assert.equal(overviewPayload.result.wallet.wallet.availableBalance, 5000);

  const tokenPurchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    vendorAuth,
    {
      idempotency_key: "idem-001",
      wallet_id: walletId,
      meter_sn: "MTR-0001",
      customer_ref: "CUST-0001",
      amount: 1000,
      site_code: "SITE_001",
    },
  );
  assert.equal(tokenPurchaseResponse.status, 200);
  const tokenPurchasePayload = await tokenPurchaseResponse.json();
  assert.match(tokenPurchasePayload.result.receipt.tokenValue, /\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}/);
  assert.equal(tokenPurchasePayload.result.wallet.availableBalance, 4000);

  const repeatedTokenPurchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    vendorAuth,
    {
      idempotency_key: "idem-001",
      wallet_id: walletId,
      meter_sn: "MTR-0001",
      customer_ref: "CUST-0001",
      amount: 1000,
      site_code: "SITE_001",
    },
  );
  assert.equal(repeatedTokenPurchaseResponse.status, 200);
  const repeatedTokenPayload = await repeatedTokenPurchaseResponse.json();
  assert.equal(repeatedTokenPayload.result.idempotent, true);
  assert.equal(
    repeatedTokenPayload.result.purchaseOrder.id,
    tokenPurchasePayload.result.purchaseOrder.id,
  );

  const remotePurchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/remote-send`,
    vendorAuth,
    {
      idempotency_key: "idem-002",
      wallet_id: walletId,
      meter_sn: "MTR-0002",
      customer_ref: "CUST-0002",
      amount: 500,
      site_code: "SITE_001",
    },
  );
  assert.equal(remotePurchaseResponse.status, 200);
  const remotePurchasePayload = await remotePurchaseResponse.json();
  assert.match(remotePurchasePayload.result.receipt.remoteSendRef, /^RMT-/);

  const purchaseDetailResponse = await fetch(
    `${baseUrl}/api/wallet/purchase/${tokenPurchasePayload.result.purchaseOrder.id}`,
    {
      headers: {
        cookie: vendorAuth.cookie,
      },
    },
  );
  assert.equal(purchaseDetailResponse.status, 200);
  const purchaseDetailPayload = await purchaseDetailResponse.json();
  assert.equal(purchaseDetailPayload.result.id, tokenPurchasePayload.result.purchaseOrder.id);
  assert.equal(purchaseDetailPayload.result.deliveryMethod, "token_generate");

  const purchaseHistoryResponse = await fetch(
    `${baseUrl}/api/wallet/${walletId}/purchases?statuses=success`,
    {
      headers: {
        cookie: vendorAuth.cookie,
      },
    },
  );
  assert.equal(purchaseHistoryResponse.status, 200);
  const purchaseHistoryPayload = await purchaseHistoryResponse.json();
  assert.equal(purchaseHistoryPayload.result.total, 2);

  const receiptResponse = await fetch(
    `${baseUrl}/api/wallet/receipt/${tokenPurchasePayload.result.receipt.id}`,
    {
      headers: {
        cookie: vendorAuth.cookie,
      },
    },
  );
  assert.equal(receiptResponse.status, 200);
  const receiptPayload = await receiptResponse.json();
  assert.equal(
    receiptPayload.result.receiptNumber,
    tokenPurchasePayload.result.receipt.receiptNumber,
  );

  const fundingHistoryResponse = await fetch(
    `${baseUrl}/api/wallet/${walletId}/funding/history?statuses=posted`,
    {
      headers: {
        cookie: vendorAuth.cookie,
      },
    },
  );
  assert.equal(fundingHistoryResponse.status, 200);
  const fundingHistoryPayload = await fundingHistoryResponse.json();
  assert.equal(fundingHistoryPayload.result.total, 1);
  assert.equal(fundingHistoryPayload.result.rows[0].status, "posted");
});

test("reconciliation routes expose and resolve wallet exceptions", async () => {
  const onboardingAdminAuth = await createAuthCookieHeader({
    username: "admin.phase0",
    displayName: "Admin User",
    role: "Administrator",
    id: "admin-phase0-1",
    app_role: "admin",
  });
  const adminAuth = await createAuthCookieHeader({
    username: "finance",
    displayName: "Finance User",
    role: "Finance",
    id: "finance-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.beta",
    displayName: "Beta Vendor",
    role: "Vendor User",
    id: "vendor-user-2",
    vendor_id: "VENDOR_BETA",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  await postJson(`${baseUrl}/api/vendor/invite`, onboardingAdminAuth, {
    vendorId: "VENDOR_BETA",
    username: "vendor.beta",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  await postJson(`${baseUrl}/api/vendor/profile`, onboardingAdminAuth, {
    vendorId: "VENDOR_BETA",
    vendorCode: "BETA001",
    businessName: "Beta Retailing Ltd",
    legalName: "Beta Retailing Limited",
    displayName: "Beta Retailing",
    contactName: "Bola Aina",
    contactEmail: "bola@beta.test",
    contactPhone: "08010000011",
    businessAddress: "8 Allen Avenue",
    registrationNumber: "RC-2002",
    taxId: "TIN-3003",
    bankName: "ACOB Bank",
    bankAccountName: "Beta Retailing Ltd",
    bankAccountNumber: "0123456790",
    bankSortCode: "000124",
    kycDocumentCount: 2,
    siteCode: "SITE_001",
    kycCompleted: true,
  });
  const approveResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_BETA/approve`, adminAuth, {});
  const approvePayload = await approveResponse.json();

  const fundingRequestResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 3000,
    channel: "bank_transfer",
    idempotency_key: "funding-beta-001",
  });
  const fundingRequestPayload = await fundingRequestResponse.json();
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingRequestPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    { fileName: "proof.png", mimeType: "image/png", fileSize: 1024 },
  );
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingRequestPayload.result.fundingRequest.id}/approve`,
    adminAuth,
    {},
  );

  const purchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/remote-send`,
    vendorAuth,
    {
      idempotency_key: "idem-local-fail",
      wallet_id: approvePayload.result.wallet.id,
      meter_sn: "LOCALFAIL-0001",
      customer_ref: "CUST-LOCALFAIL",
      amount: 500,
      site_code: "SITE_001",
    },
  );
  assert.equal(purchaseResponse.status, 202);

  const runResponse = await postJson(`${baseUrl}/api/reconciliation/run`, adminAuth, {
    dryRun: false,
  });
  assert.equal(runResponse.status, 202);

  const exceptionListResponse = await fetch(`${baseUrl}/api/reconciliation/exceptions`, {
    headers: {
      cookie: adminAuth.cookie,
    },
  });
  assert.equal(exceptionListResponse.status, 200);
  const exceptionListPayload = await exceptionListResponse.json();
  assert.ok(exceptionListPayload.result.total >= 1);
  const exceptionId = exceptionListPayload.result.rows[0].id;

  const assignResponse = await postJson(
    `${baseUrl}/api/reconciliation/exceptions/${exceptionId}/assign`,
    adminAuth,
    { assignee: "ops.lead" },
  );
  assert.equal(assignResponse.status, 200);

  const detailResponse = await fetch(`${baseUrl}/api/reconciliation/exceptions/${exceptionId}`, {
    headers: {
      cookie: adminAuth.cookie,
    },
  });
  assert.equal(detailResponse.status, 200);
  const detailPayload = await detailResponse.json();
  assert.equal(detailPayload.result.id, exceptionId);
  assert.ok(detailPayload.result.purchaseOrder);

  const escalateResponse = await postJson(
    `${baseUrl}/api/reconciliation/exceptions/${exceptionId}/escalate`,
    adminAuth,
    { reason: "Needs finance lead escalation" },
  );
  assert.equal(escalateResponse.status, 200);

  const resolveResponse = await postJson(
    `${baseUrl}/api/reconciliation/exceptions/${exceptionId}/resolve`,
    adminAuth,
    {
      resolutionCode: "released-reservation",
      resolutionNotes: "Confirmed scaffold exception path and closed it.",
    },
  );
  assert.equal(resolveResponse.status, 200);
  const resolvePayload = await resolveResponse.json();
  assert.equal(resolvePayload.result.status, "resolved");
  assert.equal(resolvePayload.result.resolutionCode, "released-reservation");

  const summaryResponse = await fetch(`${baseUrl}/api/reconciliation/summary`, {
    headers: {
      cookie: adminAuth.cookie,
    },
  });
  assert.equal(summaryResponse.status, 200);
  const summaryPayload = await summaryResponse.json();
  assert.equal(summaryPayload.result.total, 1);

  const settlementResponse = await fetch(`${baseUrl}/api/reconciliation/settlement/latest`, {
    headers: {
      cookie: adminAuth.cookie,
    },
  });
  assert.equal(settlementResponse.status, 200);
  const settlementPayload = await settlementResponse.json();
  assert.ok(Array.isArray(settlementPayload.result.rows));
});

test("vendor onboarding submission flows into the finance queue and provisions wallet on approval", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.onboarding",
    displayName: "Admin Onboarding",
    role: "Administrator",
    id: "admin-onboarding-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.onboarding",
    displayName: "Finance Onboarding",
    role: "Finance",
    id: "finance-onboarding-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.gamma",
    displayName: "Gamma Vendor",
    role: "Vendor User",
    id: "vendor-gamma-1",
    vendor_id: "VENDOR_GAMMA",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  const inviteResponse = await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_GAMMA",
    username: "vendor.gamma",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  assert.equal(inviteResponse.status, 201);

  const profileSeedResponse = await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_GAMMA",
    vendorCode: "GAMMA001",
    businessName: "Gamma Retailing Ltd",
    contactName: "Grace Musa",
    contactEmail: "grace@gamma.test",
    siteCode: "SITE_001",
  });
  assert.equal(profileSeedResponse.status, 201);

  const onboardingResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_GAMMA/onboarding`, vendorAuth, {
    legalName: "Gamma Retailing Limited",
    displayName: "Gamma Retail",
    businessName: "Gamma Retailing Ltd",
    contactName: "Grace Musa",
    contactEmail: "grace@gamma.test",
    contactPhone: "08010000001",
    alternateContactName: "Isaiah Musa",
    alternateContactPhone: "08010000002",
    businessAddress: "15 Broad Street",
    registrationNumber: "RC-7781",
    taxId: "TIN-8892",
    bankName: "ACOB Bank",
    bankAccountName: "Gamma Retailing Ltd",
    bankAccountNumber: "0123456789",
    bankSortCode: "000123",
    kycDocumentCount: 2,
    onboardingNotes: "All documents attached",
    submitForReview: true,
  });
  assert.equal(onboardingResponse.status, 200);
  const onboardingPayload = await onboardingResponse.json();
  assert.equal(onboardingPayload.result.vendor.status, "pending_review");
  assert.equal(onboardingPayload.result.readyForReview, true);

  const queueResponse = await fetch(`${baseUrl}/api/vendor/onboarding/queue?searchTerm=GAMMA`, {
    headers: {
      cookie: financeAuth.cookie,
    },
  });
  assert.equal(queueResponse.status, 200);
  const queuePayload = await queueResponse.json();
  assert.equal(queuePayload.result.total, 1);
  assert.equal(queuePayload.result.rows[0].vendorId, "VENDOR_GAMMA");
  assert.equal(queuePayload.result.rows[0].submittedDocumentsCount, 2);

  const approveResponse = await postJson(`${baseUrl}/api/vendor/approval/approve`, financeAuth, {
    vendorId: "VENDOR_GAMMA",
    notes: "Approved for activation",
  });
  assert.equal(approveResponse.status, 200);
  const approvePayload = await approveResponse.json();
  assert.equal(approvePayload.result.success, true);
  assert.equal(approvePayload.result.details.vendor.status, "active");
  assert.ok(approvePayload.result.details.wallet.id);
});

test("funding queue exposes pending requests and blocks duplicate external bank references", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.funding",
    displayName: "Admin Funding",
    role: "Administrator",
    id: "admin-funding-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.funding",
    displayName: "Finance Funding",
    role: "Finance",
    id: "finance-funding-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.delta",
    displayName: "Delta Vendor",
    role: "Vendor User",
    id: "vendor-delta-1",
    vendor_id: "VENDOR_DELTA",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_DELTA",
    username: "vendor.delta",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_DELTA",
    vendorCode: "DELTA001",
    businessName: "Delta Retailing Ltd",
    legalName: "Delta Retailing Limited",
    displayName: "Delta Retailing",
    contactName: "Dara Kola",
    contactEmail: "dara@delta.test",
    contactPhone: "08010000020",
    businessAddress: "40 Isaac John Street",
    registrationNumber: "RC-4004",
    taxId: "TIN-5005",
    bankName: "ACOB Bank",
    bankAccountName: "Delta Retailing Ltd",
    bankAccountNumber: "0123456791",
    bankSortCode: "000125",
    kycDocumentCount: 2,
    siteCode: "SITE_001",
    kycCompleted: true,
  });
  await postJson(`${baseUrl}/api/vendor/VENDOR_DELTA/approve`, financeAuth, {});

  const firstFundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 4500,
    channel: "bank_transfer",
    idempotency_key: "funding-delta-001",
  });
  assert.equal(firstFundingResponse.status, 201);
  const firstFundingPayload = await firstFundingResponse.json();
  assert.equal(firstFundingPayload.result.idempotent, undefined);

  const firstFundingReplayResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 4500,
    channel: "bank_transfer",
    idempotency_key: "funding-delta-001",
  });
  assert.equal(firstFundingReplayResponse.status, 201);
  const firstFundingReplayPayload = await firstFundingReplayResponse.json();
  assert.equal(firstFundingReplayPayload.result.idempotent, true);
  assert.equal(
    firstFundingReplayPayload.result.fundingRequest.id,
    firstFundingPayload.result.fundingRequest.id,
  );

  const firstProofResponse = await postJson(
    `${baseUrl}/api/wallet/funding/${firstFundingPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "delta-proof-1.pdf",
      mimeType: "application/pdf",
      fileSize: 2048,
    },
  );
  assert.equal(firstProofResponse.status, 200);

  const pendingQueueResponse = await fetch(`${baseUrl}/api/wallet/funding/pending`, {
    headers: {
      cookie: financeAuth.cookie,
    },
  });
  assert.equal(pendingQueueResponse.status, 200);
  const pendingQueuePayload = await pendingQueueResponse.json();
  assert.equal(pendingQueuePayload.result.total, 1);
  assert.equal(pendingQueuePayload.result.rows[0].proofStatus, "uploaded");

  const approveFirstResponse = await postJson(`${baseUrl}/api/wallet/funding/approve`, financeAuth, {
    fundingRequestId: firstFundingPayload.result.fundingRequest.id,
    externalBankRef: "BANK-REF-001",
    reviewerNote: "Confirmed against bank statement",
  });
  assert.equal(approveFirstResponse.status, 200);

  const secondFundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 2500,
    channel: "bank_transfer",
    idempotency_key: "funding-delta-002",
  });
  assert.equal(secondFundingResponse.status, 201);
  const secondFundingPayload = await secondFundingResponse.json();
  const secondProofResponse = await postJson(
    `${baseUrl}/api/wallet/funding/${secondFundingPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "delta-proof-2.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    },
  );
  assert.equal(secondProofResponse.status, 200);

  const duplicateApprovalResponse = await postJson(`${baseUrl}/api/wallet/funding/approve`, financeAuth, {
    fundingRequestId: secondFundingPayload.result.fundingRequest.id,
    externalBankRef: "BANK-REF-001",
    reviewerNote: "Duplicate reference attempt",
  });
  assert.equal(duplicateApprovalResponse.status, 409);
  const duplicateApprovalPayload = await duplicateApprovalResponse.json();
  assert.equal(duplicateApprovalPayload.reason, "DUPLICATE_BANK_REFERENCE");
});

test("funding validation supports cancel, reject, and history filtering", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.epsilon",
    displayName: "Admin Epsilon",
    role: "Administrator",
    id: "admin-epsilon-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.epsilon",
    displayName: "Finance Epsilon",
    role: "Finance",
    id: "finance-epsilon-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.epsilon",
    displayName: "Epsilon Vendor",
    role: "Vendor User",
    id: "vendor-epsilon-1",
    vendor_id: "VENDOR_EPSILON",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_EPSILON",
    username: "vendor.epsilon",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  const profileResponse = await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_EPSILON",
    vendorCode: "EPS001",
    businessName: "Epsilon Retailing Ltd",
    legalName: "Epsilon Retailing Limited",
    displayName: "Epsilon Retailing",
    contactName: "Efe Obi",
    contactEmail: "efe@epsilon.test",
    contactPhone: "08010000030",
    businessAddress: "7 Admiralty Way",
    registrationNumber: "RC-6006",
    taxId: "TIN-7007",
    bankName: "ACOB Bank",
    bankAccountName: "Epsilon Retailing Ltd",
    bankAccountNumber: "0123456792",
    bankSortCode: "000126",
    siteCode: "SITE_001",
    kycCompleted: true,
    kycDocumentCount: 2,
  });
  assert.equal(profileResponse.status, 201);
  const approveResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_EPSILON/approve`, financeAuth, {});
  const approvePayload = await approveResponse.json();
  const walletId = approvePayload.result.wallet.id;

  const invalidProofFundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 1800,
    channel: "bank_transfer",
    idempotency_key: "funding-epsilon-001",
  });
  assert.equal(invalidProofFundingResponse.status, 201);
  const invalidProofFundingPayload = await invalidProofFundingResponse.json();

  const invalidProofResponse = await postJson(
    `${baseUrl}/api/wallet/funding/${invalidProofFundingPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "proof.txt",
      mimeType: "text/plain",
      fileSize: 64,
    },
  );
  assert.equal(invalidProofResponse.status, 400);
  const invalidProofPayload = await invalidProofResponse.json();
  assert.equal(invalidProofPayload.reason, "INVALID_PROOF_FORMAT");

  const cancelResponse = await postJson(
    `${baseUrl}/api/wallet/funding/${invalidProofFundingPayload.result.fundingRequest.id}/cancel`,
    vendorAuth,
    {
      note: "Submitted with wrong payment details",
    },
  );
  assert.equal(cancelResponse.status, 200);
  const cancelPayload = await cancelResponse.json();
  assert.equal(cancelPayload.result.fundingRequest.status, "cancelled");

  const rejectFundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 2200,
    channel: "bank_transfer",
    idempotency_key: "funding-epsilon-002",
  });
  assert.equal(rejectFundingResponse.status, 201);
  const rejectFundingPayload = await rejectFundingResponse.json();

  const validProofResponse = await postJson(
    `${baseUrl}/api/wallet/funding/${rejectFundingPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "proof.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    },
  );
  assert.equal(validProofResponse.status, 200);

  const rejectResponse = await postJson(`${baseUrl}/api/wallet/funding/reject`, financeAuth, {
    fundingRequestId: rejectFundingPayload.result.fundingRequest.id,
    reason: "Proof unclear and does not match transfer amount",
  });
  assert.equal(rejectResponse.status, 200);
  const rejectPayload = await rejectResponse.json();
  assert.equal(rejectPayload.result.fundingRequest.status, "rejected");

  const historyResponse = await fetch(
    `${baseUrl}/api/wallet/${walletId}/funding/history?statuses=cancelled,rejected`,
    {
      headers: {
        cookie: vendorAuth.cookie,
      },
    },
  );
  assert.equal(historyResponse.status, 200);
  const historyPayload = await historyResponse.json();
  assert.equal(historyPayload.result.total, 2);
  assert.deepEqual(
    historyPayload.result.rows.map((row) => row.status).sort(),
    ["cancelled", "rejected"],
  );
});

test("commission rules, kpis, and settlement batches complete phase 5 end-to-end", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.phase5",
    displayName: "Admin Phase5",
    role: "Administrator",
    id: "admin-phase5-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.phase5",
    displayName: "Finance Phase5",
    role: "Finance",
    id: "finance-phase5-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.phase5",
    displayName: "Vendor Phase5",
    role: "Vendor User",
    id: "vendor-phase5-1",
    vendor_id: "VENDOR_PHASE5",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_PHASE5",
    username: "vendor.phase5",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_PHASE5",
    vendorCode: "PHASE5001",
    businessName: "Phase Five Retailing Ltd",
    legalName: "Phase Five Retailing Limited",
    displayName: "Phase Five Retailing",
    contactName: "Fola Ade",
    contactEmail: "phase5@test.local",
    contactPhone: "08010000050",
    businessAddress: "15 Bank Road",
    registrationNumber: "RC-9001",
    taxId: "TIN-9002",
    bankName: "ACOB Bank",
    bankAccountName: "Phase Five Retailing Ltd",
    bankAccountNumber: "0123456795",
    bankSortCode: "000129",
    siteCode: "SITE_001",
    kycCompleted: true,
    kycDocumentCount: 2,
  });
  const approveResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_PHASE5/approve`, financeAuth, {});
  assert.equal(approveResponse.status, 200);
  const approvePayload = await approveResponse.json();
  const walletId = approvePayload.result.wallet.id;

  const fundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 10000,
    channel: "bank_transfer",
    idempotency_key: "funding-phase5-001",
  });
  const fundingPayload = await fundingResponse.json();
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "phase5-proof.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    },
  );
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/approve`,
    financeAuth,
    {
      externalBankRef: "BANK-PHASE5-001",
    },
  );

  const firstPurchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    vendorAuth,
    {
      idempotency_key: "phase5-purchase-001",
      wallet_id: walletId,
      meter_sn: "MTR-PHASE5-001",
      customer_ref: "CUST-PHASE5-001",
      amount: 1000,
      site_code: "SITE_001",
    },
  );
  assert.equal(firstPurchaseResponse.status, 200);

  const ruleUpdateResponse = await postJson(
    `${baseUrl}/api/wallet/commission/rules-update`,
    financeAuth,
    {
      vendorId: "VENDOR_PHASE5",
      rate: 0.05,
    },
  );
  assert.equal(ruleUpdateResponse.status, 200);

  const secondPurchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    vendorAuth,
    {
      idempotency_key: "phase5-purchase-002",
      wallet_id: walletId,
      meter_sn: "MTR-PHASE5-002",
      customer_ref: "CUST-PHASE5-002",
      amount: 2000,
      site_code: "SITE_001",
    },
  );
  assert.equal(secondPurchaseResponse.status, 200);

  const commissionSummaryResponse = await fetch(`${baseUrl}/api/wallet/commission/summary`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  assert.equal(commissionSummaryResponse.status, 200);
  const commissionSummaryPayload = await commissionSummaryResponse.json();
  assert.equal(commissionSummaryPayload.result.totalAccrued, 100);
  assert.equal(commissionSummaryPayload.result.totalOutstanding, 100);
  assert.equal(commissionSummaryPayload.result.history.total, 2);

  const kpiResponse = await fetch(`${baseUrl}/api/wallet/finance/kpis`, {
    headers: {
      cookie: financeAuth.cookie,
    },
  });
  assert.equal(kpiResponse.status, 200);
  const kpiPayload = await kpiResponse.json();
  assert.equal(kpiPayload.result.total, 1);
  assert.equal(kpiPayload.result.rows[0].totalUnsettledCommission, 100);

  const previewResponse = await fetch(`${baseUrl}/api/wallet/settlement/preview`, {
    headers: {
      cookie: financeAuth.cookie,
    },
  });
  assert.equal(previewResponse.status, 200);
  const previewPayload = await previewResponse.json();
  assert.equal(previewPayload.result.totalOutstanding, 100);

  const settlementRunResponse = await postJson(`${baseUrl}/api/wallet/settlement/run`, financeAuth, {});
  assert.equal(settlementRunResponse.status, 200);
  const settlementRunPayload = await settlementRunResponse.json();
  assert.equal(settlementRunPayload.result.batch.totalCommissionCredits, 100);

  const batchesResponse = await fetch(`${baseUrl}/api/wallet/settlement/batches`, {
    headers: {
      cookie: financeAuth.cookie,
    },
  });
  assert.equal(batchesResponse.status, 200);
  const batchesPayload = await batchesResponse.json();
  assert.ok(batchesPayload.result.total >= 1);

  const historyResponse = await fetch(`${baseUrl}/api/wallet/commission/history?vendorId=VENDOR_PHASE5`, {
    headers: {
      cookie: financeAuth.cookie,
    },
  });
  assert.equal(historyResponse.status, 200);
  const historyPayload = await historyResponse.json();
  assert.equal(historyPayload.result.total, 3);
  assert.ok(historyPayload.result.rows.some((row) => row.type === "settlement"));

  const postSettlementSummaryResponse = await fetch(`${baseUrl}/api/wallet/commission/summary`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  const postSettlementSummaryPayload = await postSettlementSummaryResponse.json();
  assert.equal(postSettlementSummaryPayload.result.totalOutstanding, 0);
});

test("wallet routes rehydrate persisted wallet state after restart-like memory reset", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.phase6",
    displayName: "Admin Phase6",
    role: "Administrator",
    id: "admin-phase6-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.phase6",
    displayName: "Finance Phase6",
    role: "Finance",
    id: "finance-phase6-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.phase6",
    displayName: "Vendor Phase6",
    role: "Vendor User",
    id: "vendor-phase6-1",
    vendor_id: "VENDOR_PHASE6",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_PHASE6",
    username: "vendor.phase6",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_PHASE6",
    vendorCode: "PHASE6001",
    businessName: "Phase Six Retailing Ltd",
    legalName: "Phase Six Retailing Limited",
    displayName: "Phase Six Retailing",
    contactName: "Sade Ayo",
    contactEmail: "phase6@test.local",
    contactPhone: "08010000060",
    businessAddress: "16 Bank Road",
    registrationNumber: "RC-9101",
    taxId: "TIN-9102",
    siteCode: "SITE_001",
    kycCompleted: true,
    kycDocumentCount: 2,
    bankName: "ACOB Bank",
    bankAccountName: "Phase Six Retailing Ltd",
    bankAccountNumber: "0123456796",
    bankSortCode: "000130",
  });
  const approveResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_PHASE6/approve`, financeAuth, {});
  const approvePayload = await approveResponse.json();
  const walletId = approvePayload.result.wallet.id;

  const fundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 6000,
    channel: "bank_transfer",
    idempotency_key: "funding-phase6-001",
  });
  const fundingPayload = await fundingResponse.json();
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "phase6-proof.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    },
  );
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/approve`,
    financeAuth,
    {
      externalBankRef: "BANK-PHASE6-001",
    },
  );

  const purchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    vendorAuth,
    {
      idempotency_key: "phase6-purchase-001",
      wallet_id: walletId,
      meter_sn: "MTR-PHASE6-001",
      customer_ref: "CUST-PHASE6-001",
      amount: 1200,
      site_code: "SITE_001",
    },
  );
  const purchasePayload = await purchaseResponse.json();

  resetWalletDomainState();

  const summaryResponse = await fetch(`${baseUrl}/api/wallet/summary`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  assert.equal(summaryResponse.status, 200);
  const summaryPayload = await summaryResponse.json();
  assert.equal(summaryPayload.result.wallet.id, walletId);

  const fundingHistoryResponse = await fetch(`${baseUrl}/api/wallet/${walletId}/funding/history`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  assert.equal(fundingHistoryResponse.status, 200);
  const fundingHistoryPayload = await fundingHistoryResponse.json();
  assert.equal(fundingHistoryPayload.result.total, 1);

  const purchaseHistoryResponse = await fetch(`${baseUrl}/api/wallet/${walletId}/purchases`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  assert.equal(purchaseHistoryResponse.status, 200);
  const purchaseHistoryPayload = await purchaseHistoryResponse.json();
  assert.equal(purchaseHistoryPayload.result.total, 1);

  const receiptResponse = await fetch(
    `${baseUrl}/api/wallet/receipt/${purchasePayload.result.receipt.id}`,
    {
      headers: {
        cookie: vendorAuth.cookie,
      },
    },
  );
  assert.equal(receiptResponse.status, 200);
  const receiptPayload = await receiptResponse.json();
  assert.equal(receiptPayload.result.receipt.id, purchasePayload.result.receipt.id);
});

test("phase 7 maker-checker approvals execute manual credit, credit-limit changes, reversals, and wallet unfreeze", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.phase7",
    displayName: "Admin Phase7",
    role: "Administrator",
    id: "admin-phase7-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.phase7",
    displayName: "Finance Phase7",
    role: "Finance",
    id: "finance-phase7-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.phase7",
    displayName: "Vendor Phase7",
    role: "Vendor User",
    id: "vendor-phase7-1",
    vendor_id: "VENDOR_PHASE7",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_PHASE7",
    username: "vendor.phase7",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_PHASE7",
    vendorCode: "PHASE7001",
    businessName: "Phase Seven Retailing Ltd",
    legalName: "Phase Seven Retailing Limited",
    displayName: "Phase Seven Retailing",
    contactName: "Hauwa Bello",
    contactEmail: "phase7@test.local",
    contactPhone: "08010000070",
    businessAddress: "17 Bank Road",
    registrationNumber: "RC-9201",
    taxId: "TIN-9202",
    bankName: "ACOB Bank",
    bankAccountName: "Phase Seven Retailing Ltd",
    bankAccountNumber: "0123456797",
    bankSortCode: "000131",
    siteCode: "SITE_001",
    kycCompleted: true,
    kycDocumentCount: 2,
  });
  const approveResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_PHASE7/approve`, financeAuth, {});
  const approvePayload = await approveResponse.json();
  const walletId = approvePayload.result.wallet.id;

  const fundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 10000,
    channel: "bank_transfer",
    idempotency_key: "funding-phase7-001",
  });
  const fundingPayload = await fundingResponse.json();
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "phase7-proof.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    },
  );
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/approve`,
    financeAuth,
    {
      externalBankRef: "BANK-PHASE7-001",
    },
  );

  const manualCreditRequestResponse = await postJson(
    `${baseUrl}/api/wallet/manual-credit/request`,
    financeAuth,
    {
      walletId,
      amount: 500,
      reason: "Approved operational compensation credit",
    },
  );
  assert.equal(manualCreditRequestResponse.status, 202);
  const manualCreditRequestPayload = await manualCreditRequestResponse.json();

  const manualCreditApproveResponse = await postJson(
    `${baseUrl}/api/wallet/approvals/${manualCreditRequestPayload.result.id}/approve`,
    adminAuth,
    {},
  );
  assert.equal(manualCreditApproveResponse.status, 200);

  const creditLimitRequestResponse = await postJson(
    `${baseUrl}/api/wallet/limits/${walletId}/credit-limit`,
    financeAuth,
    {
      creditLimit: 2500,
      reason: "Increase approved vendor buffer for weekend volume",
    },
  );
  assert.equal(creditLimitRequestResponse.status, 202);
  const creditLimitRequestPayload = await creditLimitRequestResponse.json();

  const creditLimitApproveResponse = await postJson(
    `${baseUrl}/api/wallet/approvals/${creditLimitRequestPayload.result.id}/approve`,
    adminAuth,
    {},
  );
  assert.equal(creditLimitApproveResponse.status, 200);
  const creditLimitApprovePayload = await creditLimitApproveResponse.json();
  assert.equal(creditLimitApprovePayload.result.execution.creditLimit, 2500);

  const purchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    vendorAuth,
    {
      idempotency_key: "phase7-purchase-001",
      wallet_id: walletId,
      meter_sn: "MTR-PHASE7-001",
      customer_ref: "CUST-PHASE7-001",
      amount: 1000,
      site_code: "SITE_001",
    },
  );
  assert.equal(purchaseResponse.status, 200);
  const purchasePayload = await purchaseResponse.json();

  const reversalRequestResponse = await postJson(`${baseUrl}/api/wallet/reversal/request`, vendorAuth, {
    purchaseOrderId: purchasePayload.result.purchaseOrder.id,
    reason: "Customer vend failed at the point of sale",
  });
  assert.equal(reversalRequestResponse.status, 202);
  const reversalRequestPayload = await reversalRequestResponse.json();

  const approvalsResponse = await fetch(`${baseUrl}/api/wallet/approvals`, {
    headers: {
      cookie: adminAuth.cookie,
    },
  });
  assert.equal(approvalsResponse.status, 200);
  const approvalsPayload = await approvalsResponse.json();
  assert.ok(approvalsPayload.result.total >= 2);

  const reversalApproveResponse = await postJson(
    `${baseUrl}/api/wallet/approvals/${reversalRequestPayload.result.id}/approve`,
    adminAuth,
    {},
  );
  assert.equal(reversalApproveResponse.status, 200);
  const reversalApprovePayload = await reversalApproveResponse.json();
  assert.equal(reversalApprovePayload.result.execution.purchaseOrder.status, "reversed");

  const freezeRequestResponse = await postJson(`${baseUrl}/api/wallet/freeze/request`, financeAuth, {
    walletId,
    reason: "Temporary fraud review hold",
  });
  assert.equal(freezeRequestResponse.status, 202);
  const freezeRequestPayload = await freezeRequestResponse.json();

  const freezeApproveResponse = await postJson(
    `${baseUrl}/api/wallet/approvals/${freezeRequestPayload.result.id}/approve`,
    adminAuth,
    {},
  );
  assert.equal(freezeApproveResponse.status, 200);

  const blockedPurchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    vendorAuth,
    {
      idempotency_key: "phase7-purchase-blocked",
      wallet_id: walletId,
      meter_sn: "MTR-PHASE7-002",
      customer_ref: "CUST-PHASE7-002",
      amount: 500,
      site_code: "SITE_001",
    },
  );
  assert.equal(blockedPurchaseResponse.status, 400);
  const blockedPurchasePayload = await blockedPurchaseResponse.json();
  assert.match(blockedPurchasePayload.reason, /Wallet status frozen/i);

  const unfreezeRequestResponse = await postJson(`${baseUrl}/api/wallet/unfreeze/request`, financeAuth, {
    walletId,
    reason: "Fraud review cleared",
  });
  assert.equal(unfreezeRequestResponse.status, 202);
  const unfreezeRequestPayload = await unfreezeRequestResponse.json();

  const unfreezeApproveResponse = await postJson(
    `${baseUrl}/api/wallet/approvals/${unfreezeRequestPayload.result.id}/approve`,
    adminAuth,
    {},
  );
  assert.equal(unfreezeApproveResponse.status, 200);

  const summaryResponse = await fetch(`${baseUrl}/api/wallet/summary`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  assert.equal(summaryResponse.status, 200);
  const summaryPayload = await summaryResponse.json();
  assert.equal(summaryPayload.result.wallet.creditLimit, 2500);
  assert.equal(summaryPayload.result.wallet.status, "active");
  assert.equal(summaryPayload.result.wallet.availableBalance, 10500);
});

test("phase 7 rapid purchase guard freezes wallets and exposes vendor session logs", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.phase7b",
    displayName: "Admin Phase7B",
    role: "Administrator",
    id: "admin-phase7b-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.phase7b",
    displayName: "Finance Phase7B",
    role: "Finance",
    id: "finance-phase7b-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.phase7b",
    displayName: "Vendor Phase7B",
    role: "Vendor User",
    id: "vendor-phase7b-1",
    vendor_id: "VENDOR_PHASE7B",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_PHASE7B",
    username: "vendor.phase7b",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_PHASE7B",
    vendorCode: "PHASE7002",
    businessName: "Phase Seven B Retailing Ltd",
    legalName: "Phase Seven B Retailing Limited",
    displayName: "Phase Seven B Retailing",
    contactName: "Musa Ahmed",
    contactEmail: "phase7b@test.local",
    contactPhone: "08010000071",
    businessAddress: "18 Bank Road",
    registrationNumber: "RC-9203",
    taxId: "TIN-9204",
    siteCode: "SITE_001",
    kycCompleted: true,
    kycDocumentCount: 2,
    bankName: "ACOB Bank",
    bankAccountName: "Phase Seven B Retailing Ltd",
    bankAccountNumber: "0123456798",
    bankSortCode: "000132",
  });
  const approveResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_PHASE7B/approve`, financeAuth, {});
  const approvePayload = await approveResponse.json();
  const walletId = approvePayload.result.wallet.id;

  const fundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
    amount: 5000,
    channel: "bank_transfer",
    idempotency_key: "funding-phase7b-001",
  });
  const fundingPayload = await fundingResponse.json();
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "phase7b-proof.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    },
  );
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/approve`,
    financeAuth,
    {
      externalBankRef: "BANK-PHASE7B-001",
    },
  );

  for (let index = 0; index < 5; index += 1) {
    const purchaseResponse = await postJson(
      `${baseUrl}/api/wallet/purchase/generate-token`,
      vendorAuth,
      {
        idempotency_key: `phase7b-purchase-${index + 1}`,
        wallet_id: walletId,
        meter_sn: `MTR-PHASE7B-00${index + 1}`,
        customer_ref: `CUST-PHASE7B-00${index + 1}`,
        amount: 100,
        site_code: "SITE_001",
      },
      { "x-device-fingerprint": "phase7b-device-1" },
    );
    assert.equal(purchaseResponse.status, 200);
  }

  const throttledPurchaseResponse = await postJson(
    `${baseUrl}/api/wallet/purchase/generate-token`,
    vendorAuth,
    {
      idempotency_key: "phase7b-purchase-6",
      wallet_id: walletId,
      meter_sn: "MTR-PHASE7B-006",
      customer_ref: "CUST-PHASE7B-006",
      amount: 100,
      site_code: "SITE_001",
    },
    { "x-device-fingerprint": "phase7b-device-1" },
  );
  assert.equal(throttledPurchaseResponse.status, 429);
  const throttledPurchasePayload = await throttledPurchaseResponse.json();
  assert.equal(throttledPurchasePayload.reason, "PURCHASE_RATE_LIMIT_EXCEEDED");

  const sessionLogResponse = await fetch(
    `${baseUrl}/api/wallet/security/session-log?vendorId=VENDOR_PHASE7B`,
    {
      headers: {
        cookie: financeAuth.cookie,
      },
    },
  );
  assert.equal(sessionLogResponse.status, 200);
  const sessionLogPayload = await sessionLogResponse.json();
  assert.ok(sessionLogPayload.result.total >= 1);
  assert.ok(sessionLogPayload.result.rows[0].purchaseCountBusinessDay >= 6);

  const summaryResponse = await fetch(`${baseUrl}/api/wallet/overview?vendorId=VENDOR_PHASE7B`, {
    headers: {
      cookie: financeAuth.cookie,
    },
  });
  assert.equal(summaryResponse.status, 200);
  const summaryPayload = await summaryResponse.json();
  assert.equal(summaryPayload.result.wallet.wallet.status, "frozen");
});

test("phase 7 repeated bad proofs auto-suspend vendors and funding throttles emit alerts", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.phase7c",
    displayName: "Admin Phase7C",
    role: "Administrator",
    id: "admin-phase7c-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.phase7c",
    displayName: "Finance Phase7C",
    role: "Finance",
    id: "finance-phase7c-1",
    app_role: "finance",
  });
  const vendorProofAuth = await createAuthCookieHeader({
    username: "vendor.phase7cproof",
    displayName: "Vendor Phase7C Proof",
    role: "Vendor User",
    id: "vendor-phase7cproof-1",
    vendor_id: "VENDOR_PHASE7CPROOF",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });
  const vendorFundingAuth = await createAuthCookieHeader({
    username: "vendor.phase7cfund",
    displayName: "Vendor Phase7C Fund",
    role: "Vendor User",
    id: "vendor-phase7cfund-1",
    vendor_id: "VENDOR_PHASE7CFUND",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  for (const vendor of [
    {
      id: "VENDOR_PHASE7CPROOF",
      username: "vendor.phase7cproof",
      code: "PHASE7CPROOF",
      name: "Phase Seven Proof Vendor",
      email: "phase7cproof@test.local",
    },
    {
      id: "VENDOR_PHASE7CFUND",
      username: "vendor.phase7cfund",
      code: "PHASE7CFUND",
      name: "Phase Seven Funding Vendor",
      email: "phase7cfund@test.local",
    },
  ]) {
    await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
      vendorId: vendor.id,
      username: vendor.username,
      temporaryPassword: "TempPass123!",
      siteCode: "SITE_001",
    });
    await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
      vendorId: vendor.id,
      vendorCode: vendor.code,
      businessName: vendor.name,
      legalName: `${vendor.name} Ltd`,
      displayName: vendor.name,
      contactName: vendor.name,
      contactEmail: vendor.email,
      contactPhone: "08010000072",
      businessAddress: "19 Bank Road",
      registrationNumber: `RC-${vendor.code}`,
      taxId: `TIN-${vendor.code}`,
      bankName: "ACOB Bank",
      bankAccountName: vendor.name,
      bankAccountNumber: "0123456799",
      bankSortCode: "000133",
      siteCode: "SITE_001",
      kycCompleted: true,
      kycDocumentCount: 2,
    });
    await postJson(`${baseUrl}/api/vendor/${vendor.id}/approve`, financeAuth, {});
  }

  for (let index = 0; index < 3; index += 1) {
    const fundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorProofAuth, {
      amount: 1000 + index,
      channel: "bank_transfer",
      idempotency_key: `funding-phase7cproof-${index + 1}`,
    });
    assert.equal(fundingResponse.status, 201);
    const fundingPayload = await fundingResponse.json();
    const invalidProofResponse = await postJson(
      `${baseUrl}/api/wallet/funding/${fundingPayload.result.fundingRequest.id}/upload-proof`,
      vendorProofAuth,
      {
        fileName: `invalid-proof-${index + 1}.txt`,
        mimeType: "text/plain",
        fileSize: 128,
      },
    );
    assert.equal(invalidProofResponse.status, 400);
  }

  const suspendedOverviewResponse = await fetch(
    `${baseUrl}/api/wallet/overview?vendorId=VENDOR_PHASE7CPROOF`,
    {
      headers: {
        cookie: adminAuth.cookie,
      },
    },
  );
  assert.equal(suspendedOverviewResponse.status, 200);
  const suspendedOverviewPayload = await suspendedOverviewResponse.json();
  assert.equal(suspendedOverviewPayload.result.vendor.status, "suspended");
  assert.equal(suspendedOverviewPayload.result.wallet.wallet.status, "suspended");

  for (let index = 0; index < 3; index += 1) {
    const fundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorFundingAuth, {
      amount: 1500 + index,
      channel: "bank_transfer",
      idempotency_key: `funding-phase7cfund-${index + 1}`,
    });
    assert.equal(fundingResponse.status, 201);
  }

  const throttledFundingResponse = await postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorFundingAuth, {
    amount: 2000,
    channel: "bank_transfer",
    idempotency_key: "funding-phase7cfund-4",
  });
  assert.equal(throttledFundingResponse.status, 429);
  const throttledFundingPayload = await throttledFundingResponse.json();
  assert.equal(throttledFundingPayload.reason, "FUNDING_RATE_LIMIT_EXCEEDED");

  const alertsResponse = await fetch(`${baseUrl}/api/wallet/alerts`, {
    headers: {
      cookie: financeAuth.cookie,
    },
  });
  assert.equal(alertsResponse.status, 200);
  const alertsPayload = await alertsResponse.json();
  assert.ok(alertsPayload.result.rows.some((row) => row.category === "funding_rate_limit"));
});

test("phase 7 concurrent funding and purchase requests honor in-flight idempotency", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.phase7d",
    displayName: "Admin Phase7D",
    role: "Administrator",
    id: "admin-phase7d-1",
    app_role: "admin",
  });
  const financeAuth = await createAuthCookieHeader({
    username: "finance.phase7d",
    displayName: "Finance Phase7D",
    role: "Finance",
    id: "finance-phase7d-1",
    app_role: "finance",
  });
  const vendorAuth = await createAuthCookieHeader({
    username: "vendor.phase7d",
    displayName: "Vendor Phase7D",
    role: "Vendor User",
    id: "vendor-phase7d-1",
    vendor_id: "VENDOR_PHASE7D",
    site_code: "SITE_001",
    app_role: "vendor_user",
  });

  await postJson(`${baseUrl}/api/vendor/invite`, adminAuth, {
    vendorId: "VENDOR_PHASE7D",
    username: "vendor.phase7d",
    temporaryPassword: "TempPass123!",
    siteCode: "SITE_001",
  });
  await postJson(`${baseUrl}/api/vendor/profile`, adminAuth, {
    vendorId: "VENDOR_PHASE7D",
    vendorCode: "PHASE7D001",
    businessName: "Phase Seven D Retailing Ltd",
    legalName: "Phase Seven D Retailing Limited",
    displayName: "Phase Seven D Retailing",
    contactName: "Ayo Dada",
    contactEmail: "phase7d@test.local",
    contactPhone: "08010000073",
    businessAddress: "20 Bank Road",
    registrationNumber: "RC-PHASE7D001",
    taxId: "TIN-PHASE7D001",
    bankName: "ACOB Bank",
    bankAccountName: "Phase Seven D Retailing Ltd",
    bankAccountNumber: "0123456780",
    bankSortCode: "000134",
    siteCode: "SITE_001",
    kycCompleted: true,
    kycDocumentCount: 2,
  });
  const approveResponse = await postJson(`${baseUrl}/api/vendor/VENDOR_PHASE7D/approve`, financeAuth, {});
  const approvePayload = await approveResponse.json();
  const walletId = approvePayload.result.wallet.id;

  const [fundingA, fundingB] = await Promise.all([
    postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
      amount: 4000,
      channel: "bank_transfer",
      idempotency_key: "funding-phase7d-race-1",
    }),
    postJson(`${baseUrl}/api/wallet/funding/initiate`, vendorAuth, {
      amount: 4000,
      channel: "bank_transfer",
      idempotency_key: "funding-phase7d-race-1",
    }),
  ]);
  assert.equal(fundingA.status, 201);
  assert.equal(fundingB.status, 201);
  const fundingPayloadA = await fundingA.json();
  const fundingPayloadB = await fundingB.json();
  assert.equal(fundingPayloadA.result.fundingRequest.id, fundingPayloadB.result.fundingRequest.id);

  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayloadA.result.fundingRequest.id}/upload-proof`,
    vendorAuth,
    {
      fileName: "phase7d-proof.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    },
  );
  await postJson(
    `${baseUrl}/api/wallet/funding/${fundingPayloadA.result.fundingRequest.id}/approve`,
    financeAuth,
    {
      externalBankRef: "BANK-PHASE7D-001",
    },
  );

  const [purchaseA, purchaseB] = await Promise.all([
    postJson(`${baseUrl}/api/wallet/purchase/generate-token`, vendorAuth, {
      idempotency_key: "purchase-phase7d-race-1",
      wallet_id: walletId,
      meter_sn: "MTR-PHASE7D-001",
      customer_ref: "CUST-PHASE7D-001",
      amount: 500,
      site_code: "SITE_001",
    }),
    postJson(`${baseUrl}/api/wallet/purchase/generate-token`, vendorAuth, {
      idempotency_key: "purchase-phase7d-race-1",
      wallet_id: walletId,
      meter_sn: "MTR-PHASE7D-001",
      customer_ref: "CUST-PHASE7D-001",
      amount: 500,
      site_code: "SITE_001",
    }),
  ]);
  assert.equal(purchaseA.status, 200);
  assert.equal(purchaseB.status, 200);
  const purchasePayloadA = await purchaseA.json();
  const purchasePayloadB = await purchaseB.json();
  assert.equal(
    purchasePayloadA.result.purchaseOrder.id,
    purchasePayloadB.result.purchaseOrder.id,
  );

  const fundingHistoryResponse = await fetch(`${baseUrl}/api/wallet/${walletId}/funding/history`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  const fundingHistoryPayload = await fundingHistoryResponse.json();
  assert.equal(fundingHistoryPayload.result.total, 1);

  const purchaseHistoryResponse = await fetch(`${baseUrl}/api/wallet/${walletId}/purchases`, {
    headers: {
      cookie: vendorAuth.cookie,
    },
  });
  const purchaseHistoryPayload = await purchaseHistoryResponse.json();
  assert.equal(purchaseHistoryPayload.result.total, 1);
});

test("phase 7 go-live readiness reports rollout gates for internal users", async () => {
  const adminAuth = await createAuthCookieHeader({
    username: "admin.phase7e",
    displayName: "Admin Phase7E",
    role: "Administrator",
    id: "admin-phase7e-1",
    app_role: "admin",
  });

  const readinessResponse = await fetch(`${baseUrl}/api/wallet/go-live-readiness`, {
    headers: {
      cookie: adminAuth.cookie,
    },
  });
  assert.equal(readinessResponse.status, 200);
  const readinessPayload = await readinessResponse.json();
  assert.equal(typeof readinessPayload.result.overallReady, "boolean");
  assert.ok(Array.isArray(readinessPayload.result.gates));
  assert.ok(
    readinessPayload.result.gates.some((gate) => gate.key === "wallet_persistence_ready"),
  );
});
