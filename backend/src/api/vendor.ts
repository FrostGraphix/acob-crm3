import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendEnvelope } from "../services/response.js";
import { createWalletRequestContext } from "../services/wallet-domain-store.js";
import { getVendorWalletRiskService } from "../services/vendor-wallet-risk.js";
import type { VendorKycStatus } from "../services/wallet-domain-store.js";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.trim().toLowerCase() === "true") {
      return true;
    }
    if (value.trim().toLowerCase() === "false") {
      return false;
    }
  }
  return null;
}

function readKycStatus(value: unknown): VendorKycStatus | undefined {
  const status = readString(value).toLowerCase();
  if (
    status === "not_started" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "approved" ||
    status === "expired" ||
    status === "rejected"
  ) {
    return status;
  }

  return undefined;
}

function toStatusCode(error: unknown) {
  const message = error instanceof Error ? error.message : "Vendor wallet request failed";
  if (message.includes("not found")) {
    return 404;
  }
  if (message.includes("Only") || message.includes("cannot") || message.includes("allowed")) {
    return 403;
  }
  return 400;
}

export const vendorRouter = Router();

vendorRouter.get("/checklist", (request, response) => {
  sendEnvelope(response, 200, getVendorWalletRiskService().getChecklist(), "success");
});

vendorRouter.get("/onboarding/queue", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().listOnboardingQueue(context, readString(request.query.searchTerm)),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load vendor onboarding queue",
      1,
    );
  }
});

vendorRouter.post("/approval/approve", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const row = typeof body.row === "object" && body.row !== null
      ? (body.row as Record<string, unknown>)
      : null;
    const vendorId = readString(body.vendorId) || readString(row?.vendorId) || readString(row?.id);
    if (!vendorId) {
      sendEnvelope(response, 400, null, "vendorId is required", 1);
      return;
    }

    const result = getVendorWalletRiskService().approveVendor(context, vendorId, {
      riskRating: readString(body.riskRating) || undefined,
      dailyPurchaseLimit: readNumber(body.dailyPurchaseLimit) ?? readNumber(body.dailyLimit) ?? undefined,
      perTransactionLimit: readNumber(body.perTransactionLimit) ?? readNumber(body.balanceLimit) ?? undefined,
      reviewerNote: readString(body.reviewerNote) || undefined,
    });
    sendEnvelope(
      response,
      200,
      {
        success: true,
        message: "Vendor approved and wallet provisioned",
        details: result,
      },
      "Vendor approved and wallet provisioned",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to approve vendor onboarding",
      1,
    );
  }
});

vendorRouter.get("/me", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    const vendorId = readString(request.query.vendorId);
    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().getVendorSummary(context, vendorId || undefined),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load vendor profile",
      1,
    );
  }
});

vendorRouter.get("/", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(response, 200, getVendorWalletRiskService().listVendors(context), "success");
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to list vendors",
      1,
    );
  }
});

vendorRouter.get("/:vendorId", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest);
    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().getVendorDetail(context, request.params.vendorId),
      "success",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to load vendor detail",
      1,
    );
  }
});

vendorRouter.post("/invite", async (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const vendorId = readString(body.vendorId);
    const username = readString(body.username);
    const loginIdentifier = readString(body.loginIdentifier);
    const temporaryPassword = readString(body.temporaryPassword);
    const siteCode = readString(body.siteCode);
    const role = readString(body.role);

    if (!vendorId || !username || !siteCode) {
      sendEnvelope(response, 400, null, "vendorId, username, and siteCode are required", 1);
      return;
    }

    sendEnvelope(
      response,
      201,
      await getVendorWalletRiskService().createInvitation(context, {
        vendorId,
        username,
        loginIdentifier: loginIdentifier || undefined,
        temporaryPassword: temporaryPassword || undefined,
        siteCode,
        role: role === "vendor_manager" ? "vendor_manager" : "vendor_user",
      }),
      "Vendor credentials scaffolded",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to issue vendor credentials",
      1,
    );
  }
});

vendorRouter.post("/profile", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const vendorId = readString(body.vendorId);
    const vendorCode = readString(body.vendorCode);
    const businessName = readString(body.businessName);
    const contactName = readString(body.contactName);
    const contactEmail = readString(body.contactEmail);
    const siteCode = readString(body.siteCode);

    if (!vendorId || !vendorCode || !businessName || !contactName || !contactEmail || !siteCode) {
      sendEnvelope(
        response,
        400,
        null,
        "vendorId, vendorCode, businessName, contactName, contactEmail, and siteCode are required",
        1,
      );
      return;
    }

    sendEnvelope(
      response,
      201,
      getVendorWalletRiskService().createVendorProfile(context, {
        vendorId,
        vendorCode,
        businessName,
        contactName,
        contactEmail,
        siteCode,
        legalName: readString(body.legalName) || undefined,
        displayName: readString(body.displayName) || undefined,
        contactPhone: readString(body.contactPhone) || undefined,
        alternateContactName: readString(body.alternateContactName) || undefined,
        alternateContactPhone: readString(body.alternateContactPhone) || undefined,
        businessAddress: readString(body.businessAddress) || undefined,
        registrationNumber: readString(body.registrationNumber) || undefined,
        taxId: readString(body.taxId) || undefined,
        bankName: readString(body.bankName) || undefined,
        bankAccountName: readString(body.bankAccountName) || undefined,
        bankAccountNumber: readString(body.bankAccountNumber) || undefined,
        bankSortCode: readString(body.bankSortCode) || undefined,
        kycCompleted: readBoolean(body.kycCompleted) ?? false,
        kycStatus: readKycStatus(body.kycStatus),
        kycDocumentCount: readNumber(body.kycDocumentCount) ?? undefined,
        submitForReview: readBoolean(body.submitForReview) ?? false,
        onboardingNotes: readString(body.onboardingNotes) || undefined,
      }),
      "Vendor onboarding profile scaffolded",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to create vendor profile",
      1,
    );
  }
});

vendorRouter.post("/:vendorId/onboarding", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const currentSummary = getVendorWalletRiskService().getVendorDetail(context, request.params.vendorId);
    const currentVendor = currentSummary.vendor;

    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().createVendorProfile(context, {
        vendorId: request.params.vendorId,
        vendorCode: readString(body.vendorCode) || currentVendor.vendorCode,
        businessName: readString(body.businessName) || currentVendor.businessName,
        contactName: readString(body.contactName) || currentVendor.contactName,
        contactEmail: readString(body.contactEmail) || currentVendor.contactEmail,
        siteCode: readString(body.siteCode) || currentVendor.siteCode,
        legalName: readString(body.legalName) || currentVendor.legalName || undefined,
        displayName: readString(body.displayName) || currentVendor.displayName || undefined,
        contactPhone: readString(body.contactPhone) || currentVendor.contactPhone || undefined,
        alternateContactName:
          readString(body.alternateContactName) || currentVendor.alternateContactName || undefined,
        alternateContactPhone:
          readString(body.alternateContactPhone) || currentVendor.alternateContactPhone || undefined,
        businessAddress: readString(body.businessAddress) || currentVendor.businessAddress || undefined,
        registrationNumber:
          readString(body.registrationNumber) || currentVendor.registrationNumber || undefined,
        taxId: readString(body.taxId) || currentVendor.taxId || undefined,
        bankName: readString(body.bankName) || currentVendor.bankName || undefined,
        bankAccountName:
          readString(body.bankAccountName) || currentVendor.bankAccountName || undefined,
        bankAccountNumber:
          readString(body.bankAccountNumber) || currentVendor.bankAccountNumber || undefined,
        bankSortCode: readString(body.bankSortCode) || currentVendor.bankSortCode || undefined,
        kycCompleted: readBoolean(body.kycCompleted) ?? currentVendor.kycCompleted,
        kycStatus: readKycStatus(body.kycStatus),
        kycDocumentCount:
          readNumber(body.kycDocumentCount) ?? currentVendor.kycDocumentCount ?? undefined,
        submitForReview: readBoolean(body.submitForReview) ?? false,
        onboardingNotes: readString(body.onboardingNotes) || currentVendor.onboardingNotes || undefined,
      }),
      "Vendor onboarding updated",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to update vendor onboarding",
      1,
    );
  }
});

vendorRouter.post("/:vendorId/bank-account", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const currentSummary = getVendorWalletRiskService().getVendorDetail(context, request.params.vendorId);
    const currentVendor = currentSummary.vendor;

    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().createVendorProfile(context, {
        vendorId: request.params.vendorId,
        vendorCode: currentVendor.vendorCode,
        businessName: currentVendor.businessName,
        contactName: currentVendor.contactName,
        contactEmail: currentVendor.contactEmail,
        siteCode: currentVendor.siteCode,
        legalName: currentVendor.legalName || undefined,
        displayName: currentVendor.displayName || undefined,
        contactPhone: currentVendor.contactPhone || undefined,
        alternateContactName: currentVendor.alternateContactName || undefined,
        alternateContactPhone: currentVendor.alternateContactPhone || undefined,
        businessAddress: currentVendor.businessAddress || undefined,
        registrationNumber: currentVendor.registrationNumber || undefined,
        taxId: currentVendor.taxId || undefined,
        bankName: readString(body.bankName) || currentVendor.bankName || undefined,
        bankAccountName:
          readString(body.bankAccountName) || currentVendor.bankAccountName || undefined,
        bankAccountNumber:
          readString(body.bankAccountNumber) || currentVendor.bankAccountNumber || undefined,
        bankSortCode: readString(body.bankSortCode) || currentVendor.bankSortCode || undefined,
        kycCompleted: currentVendor.kycCompleted,
        kycStatus: currentVendor.kycStatus,
        kycDocumentCount: currentVendor.kycDocumentCount,
        onboardingNotes: currentVendor.onboardingNotes || undefined,
      }),
      "Vendor bank account updated",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to update vendor bank account",
      1,
    );
  }
});

vendorRouter.post("/:vendorId/approve", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().approveVendor(context, request.params.vendorId, {
        riskRating: readString(body.riskRating) || undefined,
        dailyPurchaseLimit: readNumber(body.dailyPurchaseLimit) ?? readNumber(body.dailyLimit) ?? undefined,
        perTransactionLimit: readNumber(body.perTransactionLimit) ?? readNumber(body.balanceLimit) ?? undefined,
        reviewerNote: readString(body.reviewerNote) || undefined,
      }),
      "Vendor approved and wallet provisioned",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to approve vendor",
      1,
    );
  }
});

vendorRouter.post("/:vendorId/reject", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const reason = readString(body.reason);
    const vendorMessage = readString(body.vendorMessage) || readString(body.detail);
    if (!reason || !vendorMessage) {
      sendEnvelope(response, 400, null, "reason and vendorMessage are required", 1);
      return;
    }
    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().rejectVendor(context, request.params.vendorId, {
        reason,
        vendorMessage,
        internalNote: readString(body.internalNote) || undefined,
      }),
      "Vendor application rejected",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to reject vendor",
      1,
    );
  }
});



vendorRouter.post("/:vendorId/suspend", (request, response) => {
  try {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const context = createWalletRequestContext(request as AuthenticatedRequest, body);
    const reason = readString(body.reason);
    if (!reason) {
      sendEnvelope(response, 400, null, "reason is required", 1);
      return;
    }

    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().suspendVendor(context, {
        vendorId: request.params.vendorId,
        reason,
      }),
      "Vendor suspended",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to suspend vendor",
      1,
    );
  }
});

vendorRouter.post("/:vendorId/reactivate", (request, response) => {
  try {
    const context = createWalletRequestContext(request as AuthenticatedRequest, request.body as Record<string, unknown>);
    sendEnvelope(
      response,
      200,
      getVendorWalletRiskService().reactivateVendor(context, request.params.vendorId),
      "Vendor reactivated",
    );
  } catch (error) {
    sendEnvelope(
      response,
      toStatusCode(error),
      null,
      error instanceof Error ? error.message : "Failed to reactivate vendor",
      1,
    );
  }
});
