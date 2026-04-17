import { getWalletLedgerService } from "./wallet-ledger.js";
import {
  persistApprovalRequest,
  persistCommissionRule,
  persistVendorInvitation,
  persistVendorProfile,
  persistWallet,
} from "./wallet-persistence.js";
import {
  createSupabaseAdminUser,
  isSupabaseAdminEnabled,
} from "./supabase.js";
import {
  ensureCommissionRule,
  findLatestApprovalRequestForVendor,
  getWalletDomainState,
  listApprovalRequests,
  listWalletChecklists,
  normalizeCode,
  nowIso,
  roundMoney,
  type ApprovalRequestRecord,
  type VendorKycStatus,
  type VendorProfile,
  type WalletActorRole,
  type WalletRequestContext,
} from "./wallet-domain-store.js";

export interface VendorInvitationInput {
  vendorId: string;
  username: string;
  loginIdentifier?: string;
  temporaryPassword?: string;
  siteCode: string;
  role?: "vendor_user" | "vendor_manager";
}

function generateTemporaryPassword() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*";
  const required = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghjkmnpqrstuvwxyz",
    "23456789",
    "!@#$%^&*",
  ];
  const chars = Array.from({ length: 16 - required.length }, () =>
    charset[Math.floor(Math.random() * charset.length)],
  );
  const extra = required.map((set) => set[Math.floor(Math.random() * set.length)]);
  return [...chars, ...extra].sort(() => Math.random() - 0.5).join("");
}

export interface VendorProfileInput {
  vendorId: string;
  vendorCode: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  siteCode: string;
  legalName?: string;
  displayName?: string;
  contactPhone?: string;
  alternateContactName?: string;
  alternateContactPhone?: string;
  businessAddress?: string;
  registrationNumber?: string;
  taxId?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
  kycCompleted?: boolean;
  kycStatus?: VendorKycStatus;
  kycDocumentCount?: number;
  submitForReview?: boolean;
  onboardingNotes?: string;
}

export interface VendorSuspendInput {
  vendorId: string;
  reason: string;
}

export interface VendorApprovalInput {
  riskRating?: string;
  dailyPurchaseLimit?: number;
  perTransactionLimit?: number;
  reviewerNote?: string;
}

function isInternalRole(role: WalletActorRole) {
  return role === "super_admin" || role === "admin" || role === "finance" || role === "ops_manager";
}

function isVendorRole(role: WalletActorRole) {
  return role === "vendor_user" || role === "vendor_manager";
}

function canApproveVendor(role: WalletActorRole) {
  return role === "super_admin" || role === "admin" || role === "finance";
}

function canManageCreditLimit(role: WalletActorRole) {
  return role === "super_admin" || role === "finance" || role === "admin";
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function requireVendor(vendorId: string) {
  const vendor = getWalletDomainState().vendors.get(vendorId);
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} was not found`);
  }

  return vendor;
}

function updateVendor(vendor: VendorProfile, mutate: (current: VendorProfile) => void) {
  mutate(vendor);
  vendor.riskScore = roundMoney(vendor.riskScore);
  vendor.updatedAt = nowIso();
  getWalletDomainState().vendors.set(vendor.id, vendor);
  return vendor;
}

function vendorScopeAllowed(context: WalletRequestContext, vendor: VendorProfile) {
  if (isInternalRole(context.appRole)) {
    return true;
  }

  return context.vendorId === vendor.id;
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function resolveKycStatus(input: VendorProfileInput, existing: VendorProfile | undefined): VendorKycStatus {
  if (input.kycStatus) {
    return input.kycStatus;
  }

  if (input.kycCompleted === true) {
    return "approved";
  }

  if ((input.kycDocumentCount ?? 0) > 0 || input.submitForReview) {
    return "submitted";
  }

  return existing?.kycStatus ?? "not_started";
}

function isProfileReadyForReview(profile: VendorProfile) {
  return Boolean(
    profile.legalName &&
      profile.displayName &&
      profile.contactName &&
      profile.contactEmail &&
      profile.contactPhone &&
      profile.businessAddress &&
      profile.registrationNumber &&
      profile.taxId &&
      profile.bankName &&
      profile.bankAccountName &&
      profile.bankAccountNumber &&
      profile.bankSortCode &&
      profile.kycDocumentCount > 0,
  );
}

function upsertVendorApprovalRequest(
  vendor: VendorProfile,
  context: WalletRequestContext,
  status: ApprovalRequestRecord["status"],
  notes?: string | null,
  metadataOverrides: Record<string, unknown> = {},
) {
  const state = getWalletDomainState();
  const existing = findLatestApprovalRequestForVendor(vendor.id, "vendor_onboarding");
  const now = nowIso();
  const request: ApprovalRequestRecord = {
    id: existing?.id ?? `${vendor.id}:vendor-onboarding-approval`,
    requestType: "vendor_onboarding",
    vendorId: vendor.id,
    siteCode: vendor.siteCode,
    status,
    summary: `${vendor.businessName} onboarding review`,
    submittedAt: existing?.submittedAt ?? vendor.onboardingSubmittedAt ?? now,
    submittedBy: existing?.submittedBy ?? vendor.onboardingSubmittedBy ?? context.actorUserId,
    lastUpdatedAt: now,
    checkerId: status === "pending" ? null : context.actorUserId,
    checkerAt: status === "pending" ? null : now,
    notes: notes ?? existing?.notes ?? vendor.onboardingNotes ?? null,
    metadata: {
      ...(existing?.metadata ?? {}),
      vendorCode: vendor.vendorCode,
      businessName: vendor.businessName,
      displayName: vendor.displayName,
      siteCode: vendor.siteCode,
      kycStatus: vendor.kycStatus,
      submittedDocumentCount: vendor.kycDocumentCount,
      walletStatus: vendor.walletId ? "provisioned" : "pending",
      ...metadataOverrides,
    },
  };

  state.approvalRequests.set(request.id, request);
  persistApprovalRequest(request);
  return request;
}

function requireOwnVendorProfile(context: WalletRequestContext, vendorId: string) {
  const vendor = requireVendor(vendorId);
  if (!vendorScopeAllowed(context, vendor)) {
    throw new Error("You are not allowed to update this vendor profile");
  }

  return vendor;
}

export const vendorWalletRiskService = {
  getChecklist() {
    return listWalletChecklists();
  },

  async createInvitation(context: WalletRequestContext, input: VendorInvitationInput) {
    if (!isInternalRole(context.appRole)) {
      throw new Error("Only internal staff can issue vendor credentials");
    }

    const issuedTemporaryPassword = input.temporaryPassword?.trim() || generateTemporaryPassword();
    if (issuedTemporaryPassword.length < 12) {
      throw new Error("Temporary password must be at least 12 characters");
    }

    const state = getWalletDomainState();
    const now = nowIso();
    const vendorId = normalizeCode(input.vendorId);
    const role = input.role ?? "vendor_user";
    const loginIdentifier = (input.loginIdentifier?.trim() || input.username.trim()).toLowerCase();
    let authUserId: string | null = null;

    if (isSupabaseAdminEnabled()) {
      if (!isEmailLike(loginIdentifier)) {
        throw new Error("loginIdentifier must be a valid email when Supabase auth is enabled");
      }

      const createdUser = await createSupabaseAdminUser({
        email: loginIdentifier,
        password: issuedTemporaryPassword,
        userMetadata: {
          username: input.username.trim(),
          display_name: input.username.trim(),
          site_code: normalizeCode(input.siteCode),
          vendor_id: vendorId,
          force_password_change: true,
        },
        appMetadata: {
          role,
          app_role: role,
          site_code: normalizeCode(input.siteCode),
          vendor_id: vendorId,
        },
      });
      authUserId = createdUser.id;
    }

    const invitation = {
      id: `${vendorId}:invite`,
      vendorId,
      username: input.username.trim(),
      loginIdentifier,
      role,
      authUserId,
      temporaryPasswordIssued: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 72 * 60 * 60_000).toISOString(),
      forcePasswordChange: true,
      siteCode: normalizeCode(input.siteCode),
      issuedBy: context.actorUserId,
      issuedAt: now,
    };

    state.invitations.set(vendorId, invitation);
    persistVendorInvitation(invitation);

    return {
      invitation,
      issuedTemporaryPassword,
      credentialGateSatisfied: true,
      credentialMode: authUserId ? "supabase_auth" : "scaffold_only",
      nextRequiredPhase: "phase-1",
    };
  },

  createVendorProfile(context: WalletRequestContext, input: VendorProfileInput) {
    const state = getWalletDomainState();
    const vendorId = normalizeCode(input.vendorId);
    const invitation = state.invitations.get(vendorId);
    if (!invitation) {
      throw new Error("Vendor credentials must be issued before profile creation");
    }

    const existing = state.vendors.get(vendorId);
    const internalActor = isInternalRole(context.appRole);
    const vendorActor = isVendorRole(context.appRole);
    if (!internalActor && !vendorActor) {
      throw new Error("Only internal staff or the assigned vendor can manage onboarding");
    }
    if (vendorActor && !existing) {
      throw new Error("Vendor profile must be initialized by internal staff before onboarding can continue");
    }
    if (vendorActor) {
      requireOwnVendorProfile(context, vendorId);
    }

    const now = nowIso();
    const kycStatus = resolveKycStatus(input, existing);
    const profile: VendorProfile = {
      id: vendorId,
      vendorCode: normalizeCode(input.vendorCode),
      legalName: normalizeOptional(input.legalName) ?? existing?.legalName ?? null,
      displayName: normalizeOptional(input.displayName) ?? existing?.displayName ?? input.businessName.trim(),
      businessName: input.businessName.trim(),
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      contactPhone: normalizeOptional(input.contactPhone) ?? existing?.contactPhone ?? null,
      alternateContactName:
        normalizeOptional(input.alternateContactName) ?? existing?.alternateContactName ?? null,
      alternateContactPhone:
        normalizeOptional(input.alternateContactPhone) ?? existing?.alternateContactPhone ?? null,
      businessAddress: normalizeOptional(input.businessAddress) ?? existing?.businessAddress ?? null,
      registrationNumber:
        normalizeOptional(input.registrationNumber) ?? existing?.registrationNumber ?? null,
      taxId: normalizeOptional(input.taxId) ?? existing?.taxId ?? null,
      siteCode: normalizeCode(input.siteCode),
      status: existing?.status ?? "draft",
      invitedAt: invitation.issuedAt,
      invitedBy: invitation.issuedBy,
      approvedAt: existing?.approvedAt ?? null,
      approvedBy: existing?.approvedBy ?? null,
      suspendedAt: existing?.suspendedAt ?? null,
      suspendedBy: existing?.suspendedBy ?? null,
      suspensionReason: existing?.suspensionReason ?? null,
      bankName: normalizeOptional(input.bankName) ?? existing?.bankName ?? null,
      bankAccountName: normalizeOptional(input.bankAccountName) ?? existing?.bankAccountName ?? null,
      bankAccountNumber: normalizeOptional(input.bankAccountNumber) ?? existing?.bankAccountNumber ?? null,
      bankSortCode: normalizeOptional(input.bankSortCode) ?? existing?.bankSortCode ?? null,
      walletId: existing?.walletId ?? null,
      riskScore: existing?.riskScore ?? 0,
      failedFundingProofCount: existing?.failedFundingProofCount ?? 0,
      lastFundingProofFailureAt: existing?.lastFundingProofFailureAt ?? null,
      kycCompleted: input.kycCompleted ?? kycStatus === "approved",
      kycStatus,
      kycDocumentCount: Math.max(0, input.kycDocumentCount ?? existing?.kycDocumentCount ?? 0),
      onboardingSubmittedAt:
        input.submitForReview ? now : (existing?.onboardingSubmittedAt ?? null),
      onboardingSubmittedBy:
        input.submitForReview ? context.actorUserId : (existing?.onboardingSubmittedBy ?? null),
      lastReviewedAt: existing?.lastReviewedAt ?? null,
      lastReviewedBy: existing?.lastReviewedBy ?? null,
      onboardingNotes: normalizeOptional(input.onboardingNotes) ?? existing?.onboardingNotes ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const readyForReview = isProfileReadyForReview(profile);
    if (input.submitForReview && !readyForReview) {
      throw new Error("Complete business, contact, bank, and KYC fields before submitting for review");
    }

    if (existing?.status === "active" || existing?.status === "suspended") {
      profile.status = existing.status;
    } else if (input.submitForReview && readyForReview) {
      profile.status = "pending_review";
    } else if (input.kycCompleted || existing?.status === "pending_review") {
      profile.status = "pending_review";
    } else {
      profile.status = "draft";
    }

    state.vendors.set(vendorId, profile);
    persistVendorProfile(profile);
    if (profile.status === "pending_review") {
      upsertVendorApprovalRequest(profile, context, "pending", profile.onboardingNotes);
    }

    return {
      vendor: profile,
      readyForReview,
      checklist: listWalletChecklists().phases.find((phase) => phase.key === "phase-1") ?? null,
    };
  },

  listOnboardingQueue(context: WalletRequestContext, searchTerm?: string) {
    if (!canApproveVendor(context.appRole)) {
      throw new Error("Only finance or admin roles can view the onboarding approval queue");
    }

    const search = (searchTerm ?? "").trim().toLowerCase();
    const rows = Array.from(getWalletDomainState().vendors.values())
      .filter((vendor) => vendor.status === "pending_review")
      .filter((vendor) => {
        if (!search) {
          return true;
        }

        return (
          vendor.businessName.toLowerCase().includes(search) ||
          vendor.vendorCode.toLowerCase().includes(search) ||
          vendor.siteCode.toLowerCase().includes(search) ||
          (vendor.contactEmail ?? "").toLowerCase().includes(search)
        );
      })
      .map((vendor) => {
        const approval = listApprovalRequests().find(
          (request) =>
            request.vendorId === vendor.id && request.requestType === "vendor_onboarding",
        );
        return {
          id: vendor.id,
          vendorId: vendor.id,
          vendorCode: vendor.vendorCode,
          vendorName: vendor.businessName,
          siteCode: vendor.siteCode,
          submittedAt: vendor.onboardingSubmittedAt ?? vendor.updatedAt,
          kycStatus: vendor.kycStatus,
          submittedDocumentsCount: vendor.kycDocumentCount,
          contactName: vendor.contactName,
          contactEmail: vendor.contactEmail,
          bankStatus: vendor.bankAccountNumber ? "provided" : "missing",
          approvalStatus: approval?.status ?? "pending",
          walletStatus: vendor.walletId ? "provisioned" : "pending",
        };
      })
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));

    return {
      rows,
      total: rows.length,
    };
  },

  approveVendor(
    context: WalletRequestContext,
    vendorId: string,
    input: VendorApprovalInput = {},
  ) {
    if (!canApproveVendor(context.appRole)) {
      throw new Error("Only finance or admin roles can approve vendors");
    }

    const vendor = requireVendor(normalizeCode(vendorId));
    if (vendor.status !== "pending_review" && vendor.status !== "approved") {
      throw new Error("Vendor must be in pending review before approval");
    }
    if (!isProfileReadyForReview(vendor)) {
      throw new Error("Vendor onboarding is incomplete");
    }
    if (!(vendor.kycCompleted || vendor.kycStatus === "approved" || vendor.kycStatus === "submitted")) {
      throw new Error("Vendor KYC must be submitted before approval");
    }

    const wallet = getWalletLedgerService().provisionWallet({
      vendorId: vendor.id,
      siteCode: vendor.siteCode,
      createdBy: context.actorUserId,
    });
    const commissionRule = ensureCommissionRule(vendor.id);
    const riskRating = (input.riskRating ?? "low").trim().toLowerCase();
    const riskScore = riskRating === "high" ? 50 : riskRating === "medium" ? 20 : 0;
    const reviewerNote = input.reviewerNote?.trim() || null;
    const updatedVendor = updateVendor(vendor, (current) => {
      current.status = "active";
      current.walletId = wallet.id;
      current.approvedAt = nowIso();
      current.approvedBy = context.actorUserId;
      current.lastReviewedAt = current.approvedAt;
      current.lastReviewedBy = context.actorUserId;
      current.kycCompleted = true;
      current.kycStatus = "approved";
      current.riskScore = riskScore;
      current.suspensionReason = null;
      current.suspendedAt = null;
      current.suspendedBy = null;
    });
    persistVendorProfile(updatedVendor);
    persistWallet(wallet);
    persistCommissionRule(updatedVendor.id, commissionRule);
    upsertVendorApprovalRequest(updatedVendor, context, "approved", reviewerNote ?? updatedVendor.onboardingNotes, {
      riskRating,
      dailyPurchaseLimit: input.dailyPurchaseLimit ?? null,
      perTransactionLimit: input.perTransactionLimit ?? null,
      reviewerNote,
    });

    return {
      vendor: updatedVendor,
      wallet,
      commissionRuleSeeded: true,
    };
  },

  suspendVendor(context: WalletRequestContext, input: VendorSuspendInput) {
    if (!isInternalRole(context.appRole)) {
      throw new Error("Only internal staff can suspend vendors");
    }

    const vendor = requireVendor(normalizeCode(input.vendorId));
    const updatedVendor = updateVendor(vendor, (current) => {
      current.status = "suspended";
      current.suspendedAt = nowIso();
      current.suspendedBy = context.actorUserId;
      current.suspensionReason = input.reason.trim();
      current.riskScore += 25;
    });

    if (vendor.walletId) {
      const wallet = getWalletLedgerService().getWalletById(vendor.walletId);
      if (wallet) {
        wallet.status = "suspended";
        wallet.frozenReason = input.reason.trim();
        wallet.updatedAt = nowIso();
        getWalletDomainState().wallets.set(wallet.id, wallet);
        persistWallet(wallet);
      }
    }
    persistVendorProfile(updatedVendor);

    return {
      vendor: updatedVendor,
      walletStatus: vendor.walletId
        ? getWalletLedgerService().getWalletById(vendor.walletId)?.status ?? "pending"
        : "pending",
    };
  },


  rejectVendor(
    context: WalletRequestContext,
    vendorId: string,
    input: { reason: string; vendorMessage: string; internalNote?: string },
  ) {
    if (!canApproveVendor(context.appRole)) {
      throw new Error("Only finance or admin roles can reject vendor applications");
    }

    const vendor = requireVendor(normalizeCode(vendorId));
    if (vendor.status !== "pending_review") {
      throw new Error("Only vendors in pending_review status can be rejected");
    }

    const updatedVendor = updateVendor(vendor, (current) => {
      current.status = "rejected";
      current.lastReviewedAt = nowIso();
      current.lastReviewedBy = context.actorUserId;
      current.onboardingNotes = input.vendorMessage.trim();
    });
    persistVendorProfile(updatedVendor);
    upsertVendorApprovalRequest(
      updatedVendor,
      context,
      "rejected",
      input.internalNote ?? updatedVendor.onboardingNotes,
      {
        rejectionReason: input.reason.trim(),
        vendorMessage: input.vendorMessage.trim(),
        internalNote: input.internalNote?.trim() ?? null,
      },
    );

    return { vendor: updatedVendor, rejectedBy: context.actorUserId };
  },

  reactivateVendor(context: WalletRequestContext, vendorId: string) {
    if (!isInternalRole(context.appRole)) {
      throw new Error("Only internal staff can reactivate vendors");
    }

    const vendor = requireVendor(normalizeCode(vendorId));
    const updatedVendor = updateVendor(vendor, (current) => {
      current.status = "active";
      current.suspendedAt = null;
      current.suspendedBy = null;
      current.suspensionReason = null;
      current.riskScore = Math.max(0, current.riskScore - 10);
    });

    if (vendor.walletId) {
      const wallet = getWalletLedgerService().getWalletById(vendor.walletId);
      if (wallet) {
        wallet.status = "active";
        wallet.frozenReason = null;
        wallet.updatedAt = nowIso();
        getWalletDomainState().wallets.set(wallet.id, wallet);
        persistWallet(wallet);
      }
    }
    persistVendorProfile(updatedVendor);

    return {
      vendor: updatedVendor,
      walletStatus: vendor.walletId
        ? getWalletLedgerService().getWalletById(vendor.walletId)?.status ?? "pending"
        : "pending",
    };
  },

  getVendorSummary(context: WalletRequestContext, vendorId?: string) {
    const requestedVendorId = normalizeCode(vendorId ?? context.vendorId ?? context.actorUsername);
    const vendor = requireVendor(requestedVendorId);
    if (!vendorScopeAllowed(context, vendor)) {
      throw new Error("You are not allowed to access this vendor profile");
    }

    return {
      vendor,
      wallet: vendor.walletId ? getWalletLedgerService().getWalletById(vendor.walletId) : null,
      checklist: listWalletChecklists(),
    };
  },

  getVendorDetail(context: WalletRequestContext, vendorId: string) {
    return this.getVendorSummary(context, vendorId);
  },

  listVendors(context: WalletRequestContext) {
    const vendors = Array.from(getWalletDomainState().vendors.values()).filter((vendor) => {
      if (isInternalRole(context.appRole)) {
        if (context.appRole === "ops_manager" && context.siteCode) {
          return vendor.siteCode === context.siteCode;
        }

        return true;
      }

      return context.vendorId === vendor.id;
    });

    return {
      rows: vendors,
      total: vendors.length,
    };
  },

  evaluateWalletAccess(context: WalletRequestContext, walletId: string) {
    const wallet = getWalletLedgerService().getWalletById(walletId);
    if (!wallet) {
      return {
        allowed: false,
        reason: "Wallet not found",
      };
    }

    const vendor = requireVendor(wallet.vendorId);
    if (!vendorScopeAllowed(context, vendor)) {
      return {
        allowed: false,
        reason: "Vendor scope mismatch",
      };
    }

    if (vendor.status !== "active") {
      return {
        allowed: false,
        reason: `Vendor status ${vendor.status} cannot perform wallet operations`,
      };
    }

    if (wallet.status !== "active") {
      return {
        allowed: false,
        reason: `Wallet status ${wallet.status} blocks wallet operations`,
      };
    }

    return {
      allowed: true,
      reason: "allowed",
      vendor,
      wallet,
    };
  },

  updateCreditLimit(context: WalletRequestContext, walletId: string, creditLimit: number) {
    if (!canManageCreditLimit(context.appRole)) {
      throw new Error("Only finance or admin roles can change vendor credit limits");
    }

    const wallet = getWalletLedgerService().updateCreditLimit(walletId, creditLimit);
    return {
      wallet,
      updatedBy: context.actorUserId,
    };
  },

  recordFundingProofFailure(vendorId: string, reason: string) {
    const vendor = requireVendor(normalizeCode(vendorId));
    const updatedVendor = updateVendor(vendor, (current) => {
      current.failedFundingProofCount += 1;
      current.lastFundingProofFailureAt = nowIso();
      current.riskScore += 10;
      if (current.failedFundingProofCount >= 3) {
        current.status = "suspended";
        current.suspensionReason = `Auto-suspended after repeated failed funding proofs: ${reason}`;
        current.suspendedAt = nowIso();
      }
    });
    if (updatedVendor.status === "suspended" && updatedVendor.walletId) {
      const wallet = getWalletLedgerService().getWalletById(updatedVendor.walletId);
      if (wallet) {
        wallet.status = "suspended";
        wallet.frozenReason =
          updatedVendor.suspensionReason ?? "Auto-suspended after repeated failed funding proofs";
        wallet.updatedAt = nowIso();
        getWalletDomainState().wallets.set(wallet.id, wallet);
        persistWallet(wallet);
      }
    }
    persistVendorProfile(updatedVendor);

    return {
      vendor: updatedVendor,
      autoSuspended:
        updatedVendor.failedFundingProofCount >= 3 || updatedVendor.status === "suspended",
    };
  },
};

export function getVendorWalletRiskService() {
  return vendorWalletRiskService;
}
