import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { WalletPurchaseDeliveryMethod } from "../../../common/types";
import { ACOB_RECEIPT_BRAND } from "../services/receipt-branding.ts";
import { createVendorIdempotencyKey, vendorWalletService } from "../services/vendor-wallet.ts";
import type { VendorPageConfig } from "../types/index.ts";
import type {
  VendorDashboardResponse,
  VendorCommissionSummaryResponse,
  VendorFundingRequestRecord,
  VendorMeterSearchResult,
  VendorOnboardingPayload,
  VendorProfileResponse,
  VendorReceiptDetailResponse,
  VendorReceiptsResponse,
  VendorStatementResponse,
  VendorTransactionsResponse,
} from "../types/vendor-wallet.ts";
import { CreateVendorAccountModal } from "../components/vendor/CreateVendorAccountModal.tsx";
import { ApproveVendorModal } from "../components/vendor/ApproveVendorModal.tsx";
import { RejectVendorModal } from "../components/vendor/RejectVendorModal.tsx";
import { useAuth } from "../hooks/useAuth.ts";
import { isVendorWorkspaceUser } from "../services/app-shell-state.ts";
import { request } from "../services/api.ts";
import {
  NGN,
  VwBadge,
  VwBtn,
  VwKPI,
  VwInfoBox,
  VwStepBar,
  VwConfirmTable,
  VwDivider,
} from "../components/vendor/VendorPortalPrimitives.tsx";


interface VendorPageProps {
  page: VendorPageConfig;
}

interface PurchaseComposerState {
  search: string;
  amount: string;
  deliveryMethod: WalletPurchaseDeliveryMethod;
  selectedMeter: VendorMeterSearchResult | null;
}

interface VendorOnboardingFormState {
  legalName: string;
  displayName: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  alternateContactName: string;
  alternateContactPhone: string;
  businessAddress: string;
  registrationNumber: string;
  taxId: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankSortCode: string;
  kycDocumentCount: string;
  onboardingNotes: string;
}

interface VendorQueueItem {
  id: string;
  businessName?: string;
  legalName?: string;
  vendorCode: string;
  siteName?: string;
  status: string;
}

interface HeroNavItem {
  label: string;
  value: string;
  warn?: boolean;
}

function formatMoney(value: number) {
  return NGN(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(parsed);
}

function formatDeliveryMethodLabel(method: WalletPurchaseDeliveryMethod | null | undefined) {
  return method === "remote_send" ? "Remote Send" : "Token Generate";
}

function formatFundingChannelLabel(channel: "bank_transfer" | "cash_branch") {
  return channel === "bank_transfer" ? "Bank transfer" : "Cash at branch";
}

function buildTodayStatementWindow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const date = `${year}-${month}-${day}`;

  return {
    fromDate: date,
    toDate: date,
  };
}

function downloadStatementPreview(
  rows: VendorStatementResponse["rows"],
  fromDate: string,
  toDate: string,
  format: "csv" | "xlsx" | "pdf",
) {
  const header = ["Date", "Reference", "Description", "Debit", "Credit", "Balance After"];
  const body = rows.map((row) => [
    formatDateTime(row.createdAt),
    row.reference,
    row.description,
    String(row.debit),
    String(row.credit),
    String(row.balanceAfter),
  ]);
  const csv = [header, ...body]
    .map((cells) => cells.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wallet-statement-${fromDate}-to-${toDate}.${format === "csv" ? "csv" : "csv"}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createOnboardingFormState(profile: VendorProfileResponse | null): VendorOnboardingFormState {
  return {
    legalName: profile?.vendor.legalName ?? "",
    displayName: profile?.vendor.displayName ?? "",
    businessName: profile?.vendor.businessName ?? "",
    contactName: profile?.vendor.contactName ?? "",
    contactEmail: profile?.vendor.contactEmail ?? "",
    contactPhone: profile?.vendor.contactPhone ?? "",
    alternateContactName: profile?.vendor.alternateContactName ?? "",
    alternateContactPhone: profile?.vendor.alternateContactPhone ?? "",
    businessAddress: profile?.vendor.businessAddress ?? "",
    registrationNumber: profile?.vendor.registrationNumber ?? "",
    taxId: profile?.vendor.taxId ?? "",
    bankName: profile?.vendor.bankName ?? "",
    bankAccountName: profile?.vendor.accountName ?? "",
    bankAccountNumber: "",
    bankSortCode: profile?.vendor.bankSortCode ?? "",
    kycDocumentCount:
      profile?.vendor.kycDocumentCount !== null && profile?.vendor.kycDocumentCount !== undefined
        ? String(profile.vendor.kycDocumentCount)
        : "",
    onboardingNotes: profile?.vendor.onboardingNotes ?? "",
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR DASHBOARD VIEW — Green/Lemon Financial Design
   ═══════════════════════════════════════════════════════════════════════════ */

function VendorDashboardView({
  dashboard,
}: {
  dashboard: VendorDashboardResponse | null;
}) {
  const wallet = dashboard?.wallet;
  const vendorStatus = dashboard?.vendor.status ?? "draft";
  const onboardingRequired = vendorStatus !== "active" || !wallet;
  const walletNumber = wallet?.walletNumber ?? "Wallet pending";
  const reservedBalance = wallet?.reservedBalance ?? 0;
  const postedFloat = wallet ? wallet.availableBalance + reservedBalance : 0;
  const dailyLimit = 500000;
  const todaySpend = dashboard?.todayPurchaseAmount ?? 0;
  const limitPercent = Math.min((todaySpend / dailyLimit) * 100, 100);
  const recentTransactions = dashboard?.recentTransactions ?? [];
  const purchaseBars = Array.from({ length: 14 }, (_, index) => {
    const item = recentTransactions[index];
    return item ? Math.max(28, Math.min(100, Math.round((Math.abs(item.amount) / Math.max(todaySpend, 1)) * 100))) : 35 + ((index * 9) % 45);
  });
  const successfulCount = recentTransactions.filter((entry) => entry.status === "posted" || entry.status === "successful").length;
  const failedCount = recentTransactions.filter((entry) => entry.status === "failed").length;

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      {/* ── Hero Balance Card ── */}
      <div className="vw-hero">
        <div className="vw-hero__top">
          <div>
            <div className="vw-hero__eyebrow">Available Balance</div>
            <div className="vw-hero__balance">
              {wallet ? formatMoney(wallet.availableBalance) : "₦0.00"}
            </div>
            <div className="vw-hero__sub">
              {walletNumber} · {dashboard?.vendor.siteName ?? "Site pending"}
            </div>
          </div>
          <div className="vw-hero__right">
            <div className="vw-hero__active-badge">
              <span className="vw-hero__active-dot" />
              {vendorStatus === "active" ? "Active" : vendorStatus.replace(/_/g, " ")}
            </div>
            <Link to="/vendor/buy" style={{ textDecoration: "none" }}>
              <VwBtn variant="lemon" size="sm">⚡ Buy Units</VwBtn>
            </Link>
          </div>
        </div>

        {/* ── Hero Grid ── */}
        <div className="vw-hero__grid">
          {[
            { label: "Posted Float", value: formatMoney(postedFloat) },
            { label: "Reserved", value: formatMoney(reservedBalance) },
            { label: "Today's Spend", value: formatMoney(todaySpend) },
            { label: "Daily Remaining", value: formatMoney(Math.max(dailyLimit - todaySpend, 0)), warn: limitPercent > 80 } as HeroNavItem,
          ].map((item: HeroNavItem) => (
            <div key={item.label}>
              <div className="vw-hero__grid-item-label">{item.label}</div>
              <div className={`vw-hero__grid-item-value${item.warn ? " vw-hero__grid-item-value--warn" : ""}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Daily Limit Bar ── */}
        {!onboardingRequired ? (
          <div className="vw-limit-bar">
            <div className="vw-limit-bar__header">
              <span>Daily Limit Usage</span>
              <span>{limitPercent.toFixed(0)}% · {formatMoney(dailyLimit)}</span>
            </div>
            <div className="vw-limit-bar__track">
              <div
                className={`vw-limit-bar__fill ${limitPercent > 80 ? "vw-limit-bar__fill--danger" : "vw-limit-bar__fill--ok"}`}
                style={{ width: `${limitPercent}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Status Banners ── */}
      {dashboard?.vendor.status === "suspended" ? (
        <VwInfoBox type="danger">
          <strong>Wallet access restricted.</strong> {dashboard.vendor.statusReason ?? "Contact operations support."}
        </VwInfoBox>
      ) : null}

      {dashboard?.vendor.status === "rejected" ? (
        <VwInfoBox type="danger">
          <strong>Application not approved.</strong>{" "}
          {dashboard.vendor.statusReason
            ? `Reason: ${dashboard.vendor.statusReason}`
            : "Your vendor application was reviewed and could not be approved at this time."}{" "}
          Contact your ACOB administrator for next steps.
        </VwInfoBox>
      ) : null}

      {/* ── KPI Row ── */}
      {!onboardingRequired ? (
        <div className="vw-grid-4">
          <VwKPI
            label="Posted Float"
            value={formatMoney(postedFloat)}
            sub="Available + reserved"
            iconBg="#e6f4e6"
          />
          <VwKPI
            label="Reserved"
            value={formatMoney(reservedBalance)}
            sub="Pending purchases"
            iconBg="#FFFBEB"
          />
          <VwKPI
            label="Today's Purchases"
            value={formatMoney(todaySpend)}
            sub={`${dashboard?.todayPurchaseCount ?? 0} transactions`}
            iconBg="#EFF6FF"
          />
          <VwKPI
            label="Wallet Status"
            value={wallet?.status ?? "pending"}
            sub="Active wallets can vend"
            iconBg={wallet?.status === "active" ? "#e6f4e6" : "#FFFBEB"}
          />
        </div>
      ) : null}

      {/* ── Info Box ── */}
      {!onboardingRequired ? (
        <VwInfoBox type="lemon">
          <strong>Wallet funding does not generate a token.</strong> Funding only tops up your wallet balance.
          Electricity tokens or remote sends happen later when you use the Buy Units flow.
        </VwInfoBox>
      ) : null}

      {/* ── Quick Actions ── */}
      {!onboardingRequired ? (
        <div className="vw-quick-grid">
          <Link to="/vendor/buy" className="vw-quick-card">
            <div className="vw-quick-card__icon" style={{ background: "#e6f4e6", color: "#008000" }}>⚡</div>
            <div className="vw-quick-card__title">Buy Units</div>
            <div className="vw-quick-card__desc">Token or remote send to meter</div>
          </Link>
          <Link to="/vendor/topup" className="vw-quick-card">
            <div className="vw-quick-card__icon" style={{ background: "#F4FAC2", color: "#2B3300" }}>💰</div>
            <div className="vw-quick-card__title">Fund Wallet</div>
            <div className="vw-quick-card__desc">Bank transfer & proof upload</div>
          </Link>
          <Link to="/vendor/receipts" className="vw-quick-card">
            <div className="vw-quick-card__icon" style={{ background: "#EFF6FF", color: "#2563EB" }}>🧾</div>
            <div className="vw-quick-card__title">Receipts</div>
            <div className="vw-quick-card__desc">View past purchase receipts</div>
          </Link>
          <Link to="/vendor/statement" className="vw-quick-card">
            <div className="vw-quick-card__icon" style={{ background: "#F5F3FF", color: "#5B21B6" }}>📊</div>
            <div className="vw-quick-card__title">Statement</div>
            <div className="vw-quick-card__desc">Wallet debits & credits</div>
          </Link>
        </div>
      ) : null}

      {!onboardingRequired ? (
        <div className="vw-grid-2-1">
          <div className="vw-surface vw-surface--padded">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="vw-surface__title">Purchase Volume - Last 14 Days</div>
              <VwBadge variant="success" dot>{formatMoney(recentTransactions.reduce((sum, entry) => sum + Math.abs(entry.amount), 0))} total</VwBadge>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 88 }}>
              {purchaseBars.map((height, index) => (
                <div
                  key={`${height}-${index}`}
                  style={{
                    flex: 1,
                    borderRadius: "3px 3px 0 0",
                    height: `${height}%`,
                    background: index === purchaseBars.length - 1 ? "var(--vw-primary)" : "#b7dfc8",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--vw-faint)", marginTop: 8, fontFamily: "var(--vw-mono)" }}>
              <span>14 days ago</span>
              <span>Today</span>
            </div>
          </div>

          <div className="vw-surface vw-surface--padded">
            <div className="vw-surface__title" style={{ marginBottom: 16 }}>Today's Summary</div>
            {[
              ["Purchases", formatMoney(todaySpend), "var(--vw-text)"],
              ["Transactions", `${dashboard?.todayPurchaseCount ?? 0}`, "var(--vw-text)"],
              ["Successful", `${successfulCount}`, "var(--vw-success)"],
              ["Failed", `${failedCount}`, "var(--vw-danger)"],
              ["Commission", formatMoney(0), "var(--vw-muted)"],
            ].map(([label, value, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--vw-border)", fontSize: 13 }}>
                <span style={{ color: "var(--vw-muted)" }}>{label}</span>
                <span style={{ fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Onboarding Required ── */}
      {onboardingRequired ? (
        <div className="vw-surface vw-surface--padded">
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--vw-text)", marginBottom: 8 }}>
            Complete Onboarding
          </div>
          <p style={{ fontSize: 13, color: "var(--vw-muted)", marginBottom: 16 }}>
            Wallet actions stay locked until onboarding reaches <strong>active</strong> and finance approves the profile.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Status", value: vendorStatus.replace(/_/g, " ") },
              { label: "Site", value: dashboard?.vendor.siteName ?? "Pending" },
              { label: "Next step", value: vendorStatus === "pending_review" ? "Await finance approval" : "Submit onboarding form" },
            ].map((item) => (
              <div key={item.label} style={{ background: "var(--vw-bg)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--vw-border)" }}>
                <div style={{ fontSize: 10, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vw-text)" }}>{item.value}</div>
              </div>
            ))}
          </div>
          <Link to="/vendor/profile" style={{ textDecoration: "none" }}>
            <VwBtn variant="primary">Open Onboarding Form</VwBtn>
          </Link>
        </div>
      ) : null}

      {/* ── Recent Transactions Table ── */}
      {!onboardingRequired ? (
        <div className="vw-surface">
          <div className="vw-surface__header">
            <span className="vw-surface__title">Recent Transactions</span>
            <Link to="/vendor/transactions" style={{ textDecoration: "none" }}>
              <VwBtn variant="ghost" size="sm">View All →</VwBtn>
            </Link>
          </div>
          <div className="vw-table-wrap">
            <table className="vw-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Method</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.recentTransactions ?? []).map((entry) => (
                  <tr key={entry.id}>
                    <td className="vw-td--muted">{formatDateTime(entry.createdAt)}</td>
                    <td className="vw-td--mono">{entry.reference ?? entry.receiptNumber ?? "--"}</td>
                    <td>{entry.description}</td>
                    <td>
                      {entry.deliveryMethod ? (
                        <VwBadge variant={entry.deliveryMethod === "remote_send" ? "info" : "success"}>
                          {entry.deliveryMethod === "remote_send" ? "Remote Send" : "Token"}
                        </VwBadge>
                      ) : (
                        <span className="vw-td--muted">- funding</span>
                      )}
                    </td>
                    <td className={entry.direction === "debit" ? "vw-td--danger vw-td--bold" : "vw-td--muted"}>
                      {entry.direction === "debit" ? formatMoney(entry.amount) : "--"}
                    </td>
                    <td className={entry.direction === "credit" ? "vw-td--success vw-td--bold" : "vw-td--muted"}>
                      {entry.direction === "credit" ? formatMoney(entry.amount) : "--"}
                    </td>
                    <td>
                      <VwBadge
                        variant={
                          entry.status === "posted" || entry.status === "successful" ? "success"
                          : entry.status === "failed" ? "danger"
                          : entry.status === "pending" || entry.status === "reserved" ? "warning"
                          : "gray"
                        }
                        dot
                      >
                        {entry.status}
                      </VwBadge>
                    </td>
                  </tr>
                ))}
                {(dashboard?.recentTransactions ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--vw-muted)", padding: "2rem" }}>
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR BUY VIEW — 4-Step Wizard
   ═══════════════════════════════════════════════════════════════════════════ */

function VendorBuyView({
  draft,
  onSearch,
  onDraftChange,
  onContinue,
  searching,
  results,
  availableBalance,
}: {
  draft: PurchaseComposerState;
  onSearch: (searchTerm: string) => void;
  onDraftChange: (next: PurchaseComposerState) => void;
  onContinue: () => void;
  searching: boolean;
  results: VendorMeterSearchResult[];
  availableBalance: number;
}) {
  const [step, setStep] = useState(0);
  const selectedAmount = Number(draft.amount || "0");
  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 className="vw-page-title">Buy Units</h1>
        <p className="vw-page-sub">Search a meter, set amount, choose delivery, and confirm the purchase.</p>
      </div>

      {/* ── Step Bar ── */}
      <VwStepBar
        steps={["Select Meter", "Amount & Delivery", "Confirm", "Receipt"]}
        current={step}
      />

      {/* ── Step 0: Select Meter ── */}
      {step === 0 ? (
        <div className="vw-surface vw-surface--padded vw-fadeUp">
          <div className="vw-field">
            <label className="vw-field__label">Find meter or customer</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={draft.search}
                onChange={(e) => onDraftChange({ ...draft, search: e.target.value })}
                placeholder="Meter serial or customer reference"
                style={{ flex: 1, padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", fontFamily: "var(--vw-font)", fontSize: 13 }}
              />
              <VwBtn variant="primary" size="md" onClick={() => onSearch(draft.search)} disabled={searching}>
                {searching ? "Searching…" : "Search"}
              </VwBtn>
            </div>
            <div className="vw-field__hint">Search within your assigned site scope.</div>
          </div>

          {results.length > 0 ? (
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              {results.map((result) => (
                <div
                  key={result.id}
                  onClick={() => onDraftChange({ ...draft, selectedMeter: result })}
                  style={{
                    background: draft.selectedMeter?.meterSn === result.meterSn ? "var(--vw-primary-light)" : "var(--vw-surface)",
                    border: `${draft.selectedMeter?.meterSn === result.meterSn ? "2px" : "1px"} solid ${draft.selectedMeter?.meterSn === result.meterSn ? "var(--vw-primary)" : "var(--vw-border)"}`,
                    borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--vw-text)" }}>{result.customerName}</span>
                    <VwBadge variant="gray">{result.meterType}</VwBadge>
                  </div>
                  <div style={{ fontSize: 13, fontFamily: "var(--vw-mono)", color: "var(--vw-muted)" }}>{result.meterSn}</div>
                  <div style={{ fontSize: 11, color: "var(--vw-faint)", marginTop: 4 }}>
                    {result.accountStatus} · Last vended {formatDateTime(result.lastVendedAt)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {draft.selectedMeter ? (
            <div style={{ marginTop: 18 }}>
              <VwBtn variant="primary" onClick={() => setStep(1)}>Next → Amount & Delivery</VwBtn>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Step 1: Amount & Delivery ── */}
      {step === 1 ? (
        <div className="vw-surface vw-surface--padded vw-fadeUp">
          <div style={{ background: "var(--vw-bg)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, border: "1px solid var(--vw-border)" }}>
            <span style={{ fontSize: 12, color: "var(--vw-muted)" }}>Selected: </span>
            <strong style={{ color: "var(--vw-text)", fontSize: 13 }}>
              {draft.selectedMeter?.customerName} — {draft.selectedMeter?.meterSn}
            </strong>
          </div>

          <div className="vw-field" style={{ marginBottom: 14 }}>
            <label className="vw-field__label">Amount (NGN) *</label>
            <div className="vw-field__input-wrap vw-field--prefixed">
              <span className="vw-field__prefix">₦</span>
              <input
                type="number"
                min="100"
                step="100"
                value={draft.amount}
                onChange={(e) => onDraftChange({ ...draft, amount: e.target.value })}
                placeholder="e.g. 5,000"
                style={{ paddingLeft: 28, fontWeight: 700, fontSize: 15, padding: "9px 13px 9px 28px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)" }}
              />
            </div>
            <div className="vw-amount-picks">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  className={`vw-amount-pick${Number(draft.amount) === amt ? " vw-amount-pick--active" : ""}`}
                  onClick={() => onDraftChange({ ...draft, amount: String(amt) })}
                  type="button"
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="vw-field__hint" style={{ marginTop: 8 }}>
              Available balance: <strong>{formatMoney(availableBalance)}</strong>
            </div>
          </div>

          <label className="vw-field__label" style={{ marginBottom: 8 }}>Delivery Method *</label>
          <div className="vw-delivery-grid">
            <div
              className={`vw-delivery-card vw-delivery-card--token${draft.deliveryMethod === "token_generate" ? " vw-delivery-card--selected" : ""}`}
              onClick={() => onDraftChange({ ...draft, deliveryMethod: "token_generate" })}
            >
              <div className="vw-delivery-card__emoji">🔢</div>
              <div className="vw-delivery-card__title">Generate Token</div>
              <div className="vw-delivery-card__desc">Creates a 20-digit code the customer enters on the meter keypad manually.</div>
              {draft.deliveryMethod === "token_generate" ? (
                <div className="vw-delivery-card__check" style={{ color: "var(--vw-primary)" }}>✓ Selected</div>
              ) : null}
            </div>
            <div
              className={`vw-delivery-card vw-delivery-card--remote${draft.deliveryMethod === "remote_send" ? " vw-delivery-card--selected" : ""}`}
              onClick={() => onDraftChange({ ...draft, deliveryMethod: "remote_send" })}
            >
              <div className="vw-delivery-card__emoji">📡</div>
              <div className="vw-delivery-card__title">Remote Send</div>
              <div className="vw-delivery-card__desc">Sends the vend directly to the meter electronically — no keypad entry needed.</div>
              {draft.deliveryMethod === "remote_send" ? (
                <div className="vw-delivery-card__check" style={{ color: "var(--vw-lemon-text)" }}>✓ Selected</div>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
            <VwBtn variant="outline" onClick={() => setStep(0)}>← Back</VwBtn>
            <VwBtn variant="primary" onClick={() => setStep(2)} disabled={!draft.amount || selectedAmount <= 0}>
              Next → Confirm
            </VwBtn>
          </div>
        </div>
      ) : null}

      {/* ── Step 2: Confirm ── */}
      {step === 2 ? (
        <div className="vw-surface vw-surface--padded vw-fadeUp">
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--vw-text)", marginBottom: 16 }}>
            Confirm Purchase Details
          </div>
          <VwConfirmTable
            rows={[
              { key: "Meter SN", value: draft.selectedMeter?.meterSn ?? "--", mono: true },
              { key: "Customer", value: draft.selectedMeter?.customerName ?? "--" },
              { key: "Delivery", value: formatDeliveryMethodLabel(draft.deliveryMethod) },
              { key: "Amount", value: formatMoney(selectedAmount), primary: true },
              { key: "Available Balance", value: formatMoney(availableBalance) },
              { key: "Balance After", value: formatMoney(availableBalance - selectedAmount) },
            ]}
          />
          <VwInfoBox type="warning" icon={<span>⚠️</span>}>
            This action will immediately debit <strong>{formatMoney(selectedAmount)}</strong> from your wallet.
            This cannot be undone without admin intervention.
          </VwInfoBox>
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <VwBtn variant="outline" onClick={() => setStep(1)}>← Back</VwBtn>
            <VwBtn variant="primary" onClick={onContinue} disabled={!draft.selectedMeter || !draft.amount}>
              Confirm & Debit Wallet
            </VwBtn>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR RECEIPT VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function VendorReceiptView({ detail }: { detail: VendorReceiptDetailResponse | null }) {
  const receipt = detail?.receipt;
  const receiptLines = useMemo(
    () => [
      ["Receipt No", receipt?.receiptNumber ?? "-"],
      ["Date/Time", formatDateTime(receipt?.issuedAt)],
      ["Method", formatDeliveryMethodLabel(receipt?.deliveryMethod)],
      ["Meter SN", receipt?.meterSn ?? "-"],
      ["Customer", receipt?.customerName ?? receipt?.customerRef ?? "-"],
      ["Vendor", receipt?.vendorName ?? receipt?.vendorCode ?? "-"],
      ["Site", receipt?.siteName ?? "-"],
      ["Amount", formatMoney(receipt?.amount ?? 0)],
    ],
    [receipt],
  );

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      {/* ── Receipt Success Card ── */}
      <div className="vw-receipt-success">
        <div className="vw-receipt-success__header">
          <div className="vw-receipt-success__check">
            <svg width="24" height="24" fill="none" stroke="#4ade80" strokeWidth="3" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="vw-receipt-success__title">
            {receipt?.deliveryMethod === "remote_send" ? "Remote Send Successful" : "Token Generated Successfully"}
          </div>
          <div className="vw-receipt-success__sub">{receipt?.receiptNumber ?? "Pending"}</div>
        </div>

        <div className="vw-receipt-success__body">
          <div className="vw-receipt-success__brand">
            <span className="vw-receipt-success__brand-name">{ACOB_RECEIPT_BRAND.companyName}</span>
            <span className="vw-receipt-success__brand-ref">{receipt?.receiptNumber}</span>
          </div>

          <VwConfirmTable
            rows={receiptLines.map(([k, v]) => ({ key: k, value: v, mono: k === "Receipt No" || k === "Meter SN" }))}
          />

          {/* Token Display */}
          {receipt?.deliveryMethod === "token_generate" && receipt?.tokenValue ? (
            <div className="vw-token-display">
              <div className="vw-token-display__eyebrow">🔢 Token Code — Enter on Meter Keypad</div>
              <div className="vw-token-display__code">{receipt.tokenValue}</div>
            </div>
          ) : null}

          {/* Remote Send Display */}
          {receipt?.deliveryMethod === "remote_send" ? (
            <div className="vw-remote-display">
              <div className="vw-remote-display__box">
                <div className="vw-remote-display__title">
                  ✓ Sent to meter successfully
                </div>
                <div className="vw-remote-display__ref">
                  Ref: {receipt?.remoteSendRef ?? "Processing"}
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <VwBtn variant="outline" onClick={() => window.print()}>🖨️ Print</VwBtn>
            <Link to="/vendor/buy" style={{ textDecoration: "none" }}>
              <VwBtn variant="primary">New Purchase</VwBtn>
            </Link>
            <Link to="/vendor/receipts" style={{ textDecoration: "none" }}>
              <VwBtn variant="ghost">Receipt Archive</VwBtn>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR TOP-UP VIEW — Fund Wallet Flow
   ═══════════════════════════════════════════════════════════════════════════ */

function VendorTopUpView({
  loading,
  amount,
  channel,
  proofFile,
  setAmount,
  setChannel,
  setProofFile,
  onSubmit,
}: {
  loading: boolean;
  amount: string;
  channel: "bank_transfer" | "cash_branch";
  proofFile: File | null;
  setAmount: (value: string) => void;
  setChannel: (value: "bank_transfer" | "cash_branch") => void;
  setProofFile: (value: File | null) => void;
  onSubmit: () => void;
}) {
  const [draftStep, setDraftStep] = useState<0 | 1>(0);
  const amountNumber = Number(amount || 0);
  const previewReference = useMemo(() => {
    const amountSeed = String(Math.max(Math.round(amountNumber), 0)).padStart(6, "0").slice(-6);
    const channelSeed = channel === "bank_transfer" ? "BT" : "CB";
    return `FND-${channelSeed}-${amountSeed}`;
  }, [amountNumber, channel]);
  const bankDetails = [
    ["Bank", channel === "bank_transfer" ? "First Bank of Nigeria" : "ACOB Branch Teller"],
    ["Account Name", "ACOB Lighting Technology Ltd"],
    ["Account Number", channel === "bank_transfer" ? "2047839201" : "Obtain at branch"],
    ["Amount", amount ? formatMoney(amountNumber) : "Enter amount"],
    ["Reference / Narration", previewReference],
  ] as const;

  async function copyToClipboard(value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  }

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 className="vw-page-title">Fund Wallet</h1>
        <p className="vw-page-sub">Request a wallet balance top-up, upload proof, and route it to finance for posting.</p>
      </div>

      <VwStepBar
        steps={["Initiate", "Upload Proof", "Under Review", "Confirmed", "Posted"]}
        current={draftStep === 0 ? 0 : 1}
      />

      <VwInfoBox type="lemon" icon={<span>i</span>}>
        <strong>Funding does not create a token.</strong> This process only credits your wallet balance after finance approval.
        Use <strong>Buy Units</strong> after posting when you need a token or remote-send delivery.
      </VwInfoBox>

      <div className="vw-grid-2">
        <div className="vw-surface vw-surface--padded vw-fadeUp">
          {draftStep === 0 ? (
            <>
              <div className="vw-surface__title" style={{ marginBottom: 16 }}>Step 1 - Initiate Funding Request</div>

              <div className="vw-field" style={{ marginBottom: 14 }}>
                <label className="vw-field__label">Amount (NGN) *</label>
                <div className="vw-field__input-wrap">
                  <span className="vw-field__prefix">N</span>
                  <input
                    type="number"
                    value={amount}
                    min="100"
                    step="100"
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ paddingLeft: 28, fontWeight: 700, fontSize: 15, padding: "9px 13px 9px 28px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)" }}
                  />
                </div>
              </div>

              <div className="vw-field" style={{ marginBottom: 14 }}>
                <label className="vw-field__label">Funding Channel *</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as "bank_transfer" | "cash_branch")}
                  style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)", fontSize: 13 }}
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash_branch">Cash at branch</option>
                </select>
                <div className="vw-field__hint">{formatFundingChannelLabel(channel)} requests can be tracked after submission.</div>
              </div>

              <VwInfoBox type="info">
                A funding reference is generated for review. Include the reference exactly in the transfer narration so finance can match and post the credit quickly.
              </VwInfoBox>

              <div style={{ marginTop: 18 }}>
                <VwBtn variant="primary" full onClick={() => setDraftStep(1)} disabled={!amount || amountNumber <= 0}>
                  Generate Reference
                </VwBtn>
              </div>
            </>
          ) : (
            <>
              <div className="vw-surface__title" style={{ marginBottom: 16 }}>Step 2 - Transfer and Upload Proof</div>

              <div style={{ textAlign: "center", background: "var(--vw-bg)", borderRadius: 14, padding: "20px 16px", marginBottom: 18, border: "1px solid var(--vw-border)" }}>
                <div style={{ fontSize: 12, color: "var(--vw-muted)", marginBottom: 6 }}>Funding reference</div>
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "var(--vw-mono)", color: "var(--vw-sidebar)", letterSpacing: 1.5 }}>
                  {previewReference}
                </div>
                <div style={{ fontSize: 12, color: "var(--vw-danger)", marginTop: 6, fontWeight: 700 }}>
                  Expires in 72 hours
                </div>
              </div>

              <div style={{ background: "var(--vw-bg)", borderRadius: 12, padding: 16, marginBottom: 18, border: "1px solid var(--vw-border)" }}>
                <div style={{ fontSize: 11, color: "var(--vw-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                  Transfer Details
                </div>
                {bankDetails.map(([key, value]) => {
                  const canCopy = key === "Reference / Narration" || key === "Account Number";
                  return (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--vw-border)", fontSize: 13 }}>
                      <span style={{ color: "var(--vw-muted)" }}>{key}</span>
                      <button
                        type="button"
                        onClick={canCopy ? () => void copyToClipboard(value) : undefined}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          margin: 0,
                          color: key === "Reference / Narration" ? "var(--vw-primary)" : "var(--vw-text)",
                          fontWeight: key === "Reference / Narration" ? 800 : 600,
                          fontFamily: canCopy ? "var(--vw-mono)" : "var(--vw-font)",
                          cursor: canCopy ? "pointer" : "default",
                          textAlign: "right",
                        }}
                      >
                        {value}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="vw-field" style={{ marginBottom: 10 }}>
                <label className="vw-field__label">Upload Payment Proof *</label>
                <div className="vw-upload-zone" onClick={() => document.getElementById("proof-upload")?.click()}>
                  <div className="vw-upload-zone__text">
                    {proofFile ? proofFile.name : "Drop file here or click to browse"}
                  </div>
                  <div className="vw-upload-zone__hint">PDF, JPG or PNG - max 5 MB</div>
                </div>
                <input
                  id="proof-upload"
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  style={{ display: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <VwBtn variant="outline" full onClick={() => setDraftStep(0)} disabled={loading}>
                  Back
                </VwBtn>
                <VwBtn variant="primary" full onClick={onSubmit} disabled={loading || !amount || amountNumber <= 0 || !proofFile}>
                  {loading ? "Submitting..." : "Submit Proof for Review"}
                </VwBtn>
              </div>
            </>
          )}
        </div>

        <div className="vendor-wallet-stack">
          <div className="vw-surface vw-surface--padded vw-fadeUp">
            <div className="vw-surface__title" style={{ marginBottom: 16 }}>Funding Tracker Preview</div>
            <VwConfirmTable
              rows={[
                { key: "Request Amount", value: amount ? formatMoney(amountNumber) : "N0.00", primary: true },
                { key: "Channel", value: formatFundingChannelLabel(channel) },
                { key: "Reference", value: previewReference, mono: true },
                { key: "Proof", value: proofFile ? proofFile.name : "Awaiting upload" },
                { key: "Next Step", value: draftStep === 0 ? "Generate funding reference" : "Submit proof for finance review" },
              ]}
            />
          </div>

          <div className="vw-surface vw-surface--padded vw-fadeUp">
            <div className="vw-surface__title" style={{ marginBottom: 14 }}>What happens next</div>
            <div style={{ display: "grid", gap: 10 }}>
              <VwInfoBox type="info">
                Finance reviews the transfer proof and confirms the amount against your submitted reference.
              </VwInfoBox>
              <VwInfoBox type="success">
                Once approved, a funding credit is posted to your wallet ledger and the balance updates in the dashboard.
              </VwInfoBox>
            </div>

            <VwDivider label="POSTING RULE" />

            <VwBadge variant="lemon" lg>
              Posted funding increases balance only
            </VwBadge>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--vw-muted)", lineHeight: 1.7 }}>
              Tokens and remote-send receipts are only produced from the Buy Units flow after your wallet has been credited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 className="vw-page-title">Fund Wallet</h1>
        <p className="vw-page-sub">Request a wallet balance top-up, upload proof, and route it to finance for posting.</p>
      </div>

      <VwStepBar
        steps={["Initiate", "Upload Proof", "Under Review", "Confirmed", "Posted"]}
        current={draftStep === 0 ? 0 : 1}
      />

      <VwInfoBox type="lemon" icon={<span>💡</span>}>
        <strong>Funding ≠ Token.</strong> This process increases your wallet balance only.
        To generate a customer token or remote send, use <strong>Buy Units</strong> after funding is posted.
      </VwInfoBox>

      <div className="vw-surface vw-surface--padded vw-fadeUp">
        <div className="vw-field" style={{ marginBottom: 14 }}>
          <label className="vw-field__label">Amount (NGN) *</label>
          <div className="vw-field__input-wrap">
            <span className="vw-field__prefix">₦</span>
            <input
              type="number"
              value={amount}
              min="100"
              step="100"
              onChange={(e) => setAmount(e.target.value)}
              style={{ paddingLeft: 28, fontWeight: 700, fontSize: 15, padding: "9px 13px 9px 28px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)" }}
            />
          </div>
        </div>

        <div className="vw-field" style={{ marginBottom: 14 }}>
          <label className="vw-field__label">Channel *</label>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as "bank_transfer" | "cash_branch")}
            style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)", fontSize: 13 }}
          >
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash_branch">Cash at branch</option>
          </select>
          <div className="vw-field__hint">{formatFundingChannelLabel(channel)} funding can be tracked after submission.</div>
        </div>

        <div className="vw-field" style={{ marginBottom: 14 }}>
          <label className="vw-field__label">Funding Proof *</label>
          <div className="vw-upload-zone" onClick={() => document.getElementById("proof-upload")?.click()}>
            <div className="vw-upload-zone__text">
              {proofFile ? `Attachment: ${proofFile?.name ?? ""}` : "Drop file here or click to upload"}
            </div>
            <div className="vw-upload-zone__hint">PDF, JPG, PNG · Max 5 MB</div>
          </div>
          <input
            id="proof-upload"
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
        </div>

        <VwDivider label="REVIEW" />

        <VwConfirmTable
          rows={[
            { key: "Funding Amount", value: amount ? formatMoney(Number(amount)) : "₦0.00", primary: true },
            { key: "Channel", value: formatFundingChannelLabel(channel) },
            { key: "Proof", value: proofFile?.name ?? "Not attached" },
            { key: "Next Step", value: proofFile ? "Await finance review" : "Attach proof before submission" },
          ]}
        />

        <div style={{ marginTop: 18 }}>
          <VwBtn variant="primary" full onClick={onSubmit} disabled={loading || !amount}>
            {loading ? "Submitting…" : "Create Funding Request"}
          </VwBtn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA TABLE — Shared table primitive used by transactions, receipts, etc.
   ═══════════════════════════════════════════════════════════════════════════ */

function DataTable({
  title,
  description,
  headers,
  rows,
}: {
  title: string;
  description: string;
  headers: string[];
  rows: Array<Array<string>>;
}) {
  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 className="vw-page-title">{title}</h1>
        <p className="vw-page-sub">{description}</p>
      </div>

      <div className="vw-surface">
        <div className="vw-table-wrap">
          <table className="vw-table">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index + 1}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${index + 1}-${cellIndex + 1}`}>{cell}</td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} style={{ textAlign: "center", color: "var(--vw-muted)", padding: "2rem" }}>
                    No records to show yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR ONBOARDING VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function VendorOnboardingView({
  profile,
  form,
  setForm,
  submitting,
  feedback,
  onSubmit,
}: {
  profile: VendorProfileResponse | null;
  form: VendorOnboardingFormState;
  setForm: (value: VendorOnboardingFormState) => void;
  submitting: boolean;
  feedback: string | null;
  onSubmit: () => void;
}) {
  const vendorStatus = profile?.vendor.status ?? "draft";

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 className="vw-page-title">Vendor Onboarding</h1>
        <p className="vw-page-sub">Complete business, contact, bank, and KYC details for finance approval.</p>
      </div>

      {/* Status progress */}
      <VwStepBar
        steps={["Draft", "Pending Review", "Active"]}
        current={vendorStatus === "active" ? 3 : vendorStatus === "pending_review" ? 1 : 0}
      />

      {feedback ? <VwInfoBox type={feedback.includes("Failed") ? "danger" : "success"}>{feedback}</VwInfoBox> : null}

      {vendorStatus === "pending_review" ? (
        <VwInfoBox type="info">
          Finance review in progress. You can still update and resubmit if corrections are needed.
        </VwInfoBox>
      ) : null}

      <div className="vw-surface vw-surface--padded">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { label: "Legal name", key: "legalName" as const },
            { label: "Display name", key: "displayName" as const },
            { label: "Business name", key: "businessName" as const },
            { label: "Registration number", key: "registrationNumber" as const },
            { label: "Tax ID", key: "taxId" as const },
            { label: "Primary contact name", key: "contactName" as const },
            { label: "Contact email", key: "contactEmail" as const },
            { label: "Contact phone", key: "contactPhone" as const },
            { label: "Alternate contact", key: "alternateContactName" as const },
            { label: "Alternate phone", key: "alternateContactPhone" as const },
            { label: "Bank name", key: "bankName" as const },
            { label: "Account name", key: "bankAccountName" as const },
            { label: "Account number", key: "bankAccountNumber" as const },
            { label: "Sort code", key: "bankSortCode" as const },
          ].map((field) => (
            <div className="vw-field" key={field.key}>
              <label className="vw-field__label">{field.label}</label>
              <input
                value={form[field.key]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)", fontSize: 13 }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          <div className="vw-field">
            <label className="vw-field__label">Business address</label>
            <textarea
              rows={3}
              value={form.businessAddress}
              onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
              style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)", fontSize: 13, resize: "vertical" }}
            />
          </div>
          <div className="vw-field">
            <label className="vw-field__label">Submission notes</label>
            <textarea
              rows={3}
              value={form.onboardingNotes}
              onChange={(e) => setForm({ ...form, onboardingNotes: e.target.value })}
              style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)", fontSize: 13, resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <VwBtn variant="primary" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit For Finance Review"}
          </VwBtn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN VENDOR QUEUE VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function AdminVendorQueueView() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [queue, setQueue] = useState<VendorQueueItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewVendor, setReviewVendor] = useState<VendorQueueItem | null>(null);
  const [actionModal, setActionModal] = useState<"approve" | "reject" | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await request<VendorQueueItem[]>("/api/vendor/onboarding/queue");
      setQueue(data);
    } catch (err) {
      console.error("Failed to fetch queue", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQueue();
  }, []);

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--vw-primary)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 4 }}>
            Finance Operations
          </div>
          <h1 className="vw-page-title">Vendor Management</h1>
          <p className="vw-page-sub">
            Approve onboarding applications, monitor wallet funding, and oversee vendor float.
          </p>
        </div>
        <VwBtn variant="primary" onClick={() => setShowCreateModal(true)}>+ Create Vendor Account</VwBtn>
      </div>

      <div className="vw-surface">
        <div className="vw-surface__header">
          <span className="vw-surface__title">Pending Reviews</span>
          <VwBtn variant="ghost" size="sm" onClick={fetchQueue} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </VwBtn>
        </div>
        <div className="vw-table-wrap">
          <table className="vw-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Site</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !queue ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--vw-muted)", padding: "2rem" }}>
                    Loading vendor queue…
                  </td>
                </tr>
              ) : queue?.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--vw-muted)", padding: "2rem" }}>
                    No vendors in onboarding queue.
                  </td>
                </tr>
              ) : (
                queue?.map((v) => (
                  <tr key={v.id}>
                    <td className="vw-td--bold">{v.businessName || v.legalName || v.vendorCode}</td>
                    <td className="vw-td--muted">{v.siteName || "Pending"}</td>
                    <td>
                      <VwBadge variant={v.status === "active" ? "success" : v.status === "rejected" ? "danger" : "warning"} dot>
                        {v.status}
                      </VwBadge>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <VwBtn
                          variant="subtle"
                          size="xs"
                          onClick={() => { setReviewVendor(v); setActionModal("approve"); }}
                        >
                          Approve
                        </VwBtn>
                        <VwBtn
                          variant="danger"
                          size="xs"
                          onClick={() => { setReviewVendor(v); setActionModal("reject"); }}
                        >
                          Reject
                        </VwBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateVendorAccountModal
          onClose={() => setShowCreateModal(false)}
          onVendorCreated={() => {
            setShowCreateModal(false);
            void fetchQueue();
          }}
        />
      )}

      {actionModal === "approve" && reviewVendor && (
        <ApproveVendorModal
          vendorId={reviewVendor.id}
          businessName={reviewVendor.businessName}
          onClose={() => {
            setActionModal(null);
            setReviewVendor(null);
          }}
          onApproved={() => {
            setActionModal(null);
            setReviewVendor(null);
            void fetchQueue();
          }}
        />
      )}

      {actionModal === "reject" && reviewVendor && (
        <RejectVendorModal
          vendorId={reviewVendor.id}
          businessName={reviewVendor.businessName}
          onClose={() => {
            setActionModal(null);
            setReviewVendor(null);
          }}
          onRejected={() => {
            setActionModal(null);
            setReviewVendor(null);
            void fetchQueue();
          }}
        />
      )}
    </div>
  );
}


export function VendorPage({ page }: VendorPageProps) {
  const navigate = useNavigate();
  const params = useParams();
  const { user: authUser } = useAuth();
  const [dashboard, setDashboard] = useState<VendorDashboardResponse | null>(null);
  const [commissionSummary, setCommissionSummary] = useState<VendorCommissionSummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<VendorTransactionsResponse | null>(null);
  const [receipts, setReceipts] = useState<VendorReceiptsResponse | null>(null);
  const [statement, setStatement] = useState<VendorStatementResponse | null>(null);
  const [profile, setProfile] = useState<VendorProfileResponse | null>(null);
  const [receiptDetail, setReceiptDetail] = useState<VendorReceiptDetailResponse | null>(null);
  const [fundingRequest, setFundingRequest] = useState<VendorFundingRequestRecord | null>(null);
  const [onboardingForm, setOnboardingForm] = useState<VendorOnboardingFormState>(
    createOnboardingFormState(null),
  );
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [searchingMeters, setSearchingMeters] = useState(false);
  const [searchResults, setSearchResults] = useState<VendorMeterSearchResult[]>([]);
  const [topUpAmount, setTopUpAmount] = useState("5000");
  const [topUpChannel, setTopUpChannel] = useState<"bank_transfer" | "cash_branch">("bank_transfer");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<"all" | "debits" | "credits" | "successful" | "failed">("all");
  const [statementRange, setStatementRange] = useState(buildTodayStatementWindow());
  const [statementFormat, setStatementFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseComposerState>({
    search: "",
    amount: "5000",
    deliveryMethod: "remote_send",
    selectedMeter: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (page.vendorView === "dashboard") {
        const result = await vendorWalletService.loadDashboard();
        if (!cancelled) {
          setDashboard(result);
        }
        return;
      }

      if (page.vendorView === "transactions") {
        const result = await vendorWalletService.loadTransactions();
        if (!cancelled) {
          setTransactions(result);
        }
        return;
      }

      if (page.vendorView === "commission") {
        const result = await vendorWalletService.loadCommissionSummary();
        if (!cancelled) {
          setCommissionSummary(result);
        }
        return;
      }

      if (page.vendorView === "receipts") {
        const result = await vendorWalletService.loadReceipts();
        if (!cancelled) {
          setReceipts(result);
        }
        return;
      }

      if (page.vendorView === "statement") {
        const result = await vendorWalletService.loadStatement(statementRange);
        if (!cancelled) {
          setStatement(result);
        }
        return;
      }

      if (page.vendorView === "profile") {
        const result = await vendorWalletService.loadProfile();
        if (!cancelled) {
          setProfile(result);
        }
        return;
      }

      if (page.vendorView === "buy-receipt" && params.receiptId) {
        const result = await vendorWalletService.loadReceipt(params.receiptId);
        if (!cancelled) {
          setReceiptDetail(result);
          vendorWalletService.cacheReceiptDetail(result);
        }
        return;
      }

      if (page.vendorView === "buy-confirm") {
        const draft = vendorWalletService.readPurchaseDraft();
        if (draft && !cancelled) {
          setPurchaseDraft({
            search: draft.customerRef,
            amount: String(draft.amount),
            deliveryMethod: draft.deliveryMethod,
            selectedMeter: {
              id: draft.meterSn,
              customerName: draft.customerName,
              customerRef: draft.customerRef,
              meterSn: draft.meterSn,
              meterType: draft.meterType,
              accountStatus: draft.accountStatus,
              siteCode: draft.siteCode,
              lastVendedAt: null,
            },
          });
        }
        return;
      }

      if (page.vendorView === "topup-status" && params.requestId) {
        const result = await vendorWalletService.loadFundingRequest(params.requestId);
        if (!cancelled) {
          setFundingRequest(result);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [page.vendorView, params.receiptId, params.requestId, statementRange]);

  const availableBalance = dashboard?.wallet?.availableBalance ?? profile?.wallet?.availableBalance ?? 0;
  const filteredTransactions = (transactions?.rows ?? []).filter((row) => {
    if (transactionFilter === "all") {
      return true;
    }
    if (transactionFilter === "debits") {
      return row.direction === "debit";
    }
    if (transactionFilter === "credits") {
      return row.direction === "credit";
    }
    if (transactionFilter === "successful") {
      return row.status.toLowerCase().includes("posted") || row.status.toLowerCase().includes("successful");
    }
    if (transactionFilter === "failed") {
      return row.status.toLowerCase().includes("failed") || row.status.toLowerCase().includes("rejected");
    }
    return true;
  });

  useEffect(() => {
    if (profile) {
      setOnboardingForm(createOnboardingFormState(profile));
    }
  }, [profile]);

  async function handleSearchMeters(searchTerm: string) {
    setSearchingMeters(true);
    try {
      const rows = await vendorWalletService.searchMeters(searchTerm);
      setSearchResults(rows);
    } finally {
      setSearchingMeters(false);
    }
  }

  function handleContinuePurchase() {
    if (!purchaseDraft.selectedMeter) {
      return;
    }

    vendorWalletService.savePurchaseDraft({
      idempotencyKey: createVendorIdempotencyKey(),
      walletId: dashboard?.wallet?.id ?? profile?.wallet?.id ?? "wallet-demo",
      meterSn: purchaseDraft.selectedMeter.meterSn,
      customerRef: purchaseDraft.selectedMeter.customerRef,
      amount: Number(purchaseDraft.amount),
      siteCode: purchaseDraft.selectedMeter.siteCode,
      customerName: purchaseDraft.selectedMeter.customerName,
      meterType: purchaseDraft.selectedMeter.meterType,
      accountStatus: purchaseDraft.selectedMeter.accountStatus,
      deliveryMethod: purchaseDraft.deliveryMethod,
      availableBalance,
      walletStatus: dashboard?.wallet?.status ?? profile?.wallet?.status ?? null,
      vendorStatus: dashboard?.vendor.status ?? "active",
    });
    navigate("/vendor/buy/confirm");
  }

  async function handleSubmitPurchase() {
    const draft = vendorWalletService.readPurchaseDraft();
    if (!draft) {
      return;
    }

    setSubmitting(true);
    try {
        const payload = {
        idempotencyKey: draft.idempotencyKey || createVendorIdempotencyKey(),
        walletId: draft.walletId,
        meterSn: draft.meterSn,
        customerRef: draft.customerRef,
        amount: draft.amount,
        siteCode: draft.siteCode,
      };
      const result =
        draft.deliveryMethod === "remote_send"
          ? await vendorWalletService.purchaseRemoteSend(payload)
          : await vendorWalletService.purchaseGenerateToken(payload);

      if (result.receiptId) {
        vendorWalletService.clearPurchaseDraft();
        navigate(`/vendor/buy/receipt/${result.receiptId}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitFundingRequest() {
    setSubmitting(true);
    try {
      const created = await vendorWalletService.createFundingRequest({
        walletId: dashboard?.wallet?.id ?? profile?.wallet?.id ?? "wallet-demo",
        amount: Number(topUpAmount),
        channel: topUpChannel,
        idempotencyKey: createVendorIdempotencyKey(),
      });

      if (proofFile) {
        const upload = await vendorWalletService.uploadFundingProof(proofFile);
        await vendorWalletService.submitFundingProof(created.id, {
          fileName: proofFile.name,
          documentId: upload.documentId,
          mimeType: proofFile.type,
          fileSize: proofFile.size,
        });
      }

      navigate(`/vendor/topup/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitOnboarding() {
    if (!profile?.vendor.vendorCode || !profile.vendor.businessName) {
      return;
    }

    setSubmitting(true);
    setProfileFeedback(null);
    try {
      const payload: VendorOnboardingPayload = {
        vendorId: profile.vendor.id ?? profile.user.vendorId ?? "",
        vendorCode: profile.vendor.vendorCode,
        businessName: onboardingForm.businessName,
        legalName: onboardingForm.legalName,
        displayName: onboardingForm.displayName,
        contactName: onboardingForm.contactName,
        contactEmail: onboardingForm.contactEmail,
        contactPhone: onboardingForm.contactPhone,
        alternateContactName: onboardingForm.alternateContactName,
        alternateContactPhone: onboardingForm.alternateContactPhone,
        businessAddress: onboardingForm.businessAddress,
        registrationNumber: onboardingForm.registrationNumber,
        taxId: onboardingForm.taxId,
        bankName: onboardingForm.bankName,
        bankAccountName: onboardingForm.bankAccountName,
        bankAccountNumber: onboardingForm.bankAccountNumber,
        bankSortCode: onboardingForm.bankSortCode,
        kycDocumentCount: Number(onboardingForm.kycDocumentCount || "0"),
        onboardingNotes: onboardingForm.onboardingNotes,
        submitForReview: true,
      };

      await vendorWalletService.submitOnboarding(payload);
      const refreshed = await vendorWalletService.loadProfile();
      setProfile(refreshed);
      setProfileFeedback("Onboarding submitted for finance review.");
    } catch (error) {
      setProfileFeedback(error instanceof Error ? error.message : "Failed to submit onboarding");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Admin view: route vendor management pages to admin-specific UI ──
  if (!isVendorWorkspaceUser(authUser)) {
    if (page.vendorView === "dashboard") {
      return <AdminVendorQueueView />;
    }
    // For all other vendor page views, render the admin management wrapper
    return <AdminVendorQueueView />;
  }

  if (page.vendorView === "dashboard") {
    return <VendorDashboardView dashboard={dashboard} />;
  }

  if (page.vendorView === "buy") {
    return (
      <VendorBuyView
        draft={purchaseDraft}
        onSearch={handleSearchMeters}
        onDraftChange={setPurchaseDraft}
        onContinue={handleContinuePurchase}
        searching={searchingMeters}
        results={searchResults}
        availableBalance={availableBalance}
      />
    );
  }

  if (page.vendorView === "buy-confirm") {
    const draft = vendorWalletService.readPurchaseDraft();
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <div style={{ marginBottom: 4 }}>
          <h1 className="vw-page-title">Confirm Purchase</h1>
          <p className="vw-page-sub">Review the meter, amount, and delivery path before debiting the wallet.</p>
        </div>
        <VwStepBar steps={["Select Meter", "Amount & Delivery", "Confirm", "Receipt"]} current={2} />
        {draft ? (
          <div className="vw-surface vw-surface--padded vw-fadeUp">
            <VwConfirmTable
              rows={[
                { key: "Customer", value: draft.customerName },
                { key: "Meter SN", value: draft.meterSn, mono: true },
                { key: "Amount", value: formatMoney(draft.amount), primary: true },
                { key: "Delivery Method", value: draft.deliveryMethod === "remote_send" ? "Remote Send" : "Token Generate" },
                { key: "Available Balance", value: formatMoney(draft.availableBalance) },
              ]}
            />
            <VwInfoBox type="warning" icon={<span>⚠️</span>}>
              This will immediately debit <strong>{formatMoney(draft.amount)}</strong> from your wallet.
            </VwInfoBox>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <Link to="/vendor/buy" style={{ textDecoration: "none" }}>
                <VwBtn variant="outline">← Back</VwBtn>
              </Link>
              <VwBtn variant="primary" onClick={() => void handleSubmitPurchase()} disabled={submitting}>
                {submitting ? "Processing…" : "Confirm Debit"}
              </VwBtn>
            </div>
          </div>
        ) : (
          <VwInfoBox type="warning">No pending draft. Start from the Buy Units screen.</VwInfoBox>
        )}
      </div>
    );
  }

  if (page.vendorView === "buy-receipt") {
    return <VendorReceiptView detail={receiptDetail ?? vendorWalletService.readCachedReceiptDetail()} />;
  }

  if (page.vendorView === "commission") {
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <div style={{ marginBottom: 4 }}>
          <h1 className="vw-page-title">Commission</h1>
          <p className="vw-page-sub">Accrued commission, settlement history, and current rate.</p>
        </div>
        <div className="vw-grid-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <VwKPI
            label="Outstanding"
            value={formatMoney(commissionSummary?.totalOutstanding ?? 0)}
            iconBg="#FFFBEB"
          />
          <VwKPI
            label="Total Accrued"
            value={formatMoney(commissionSummary?.totalAccrued ?? 0)}
            iconBg="#e6f4e6"
          />
          <VwKPI
            label="Settlement Rate"
            value={`${((commissionSummary?.rule.rate ?? 0) * 100).toFixed(2)}%`}
            sub={commissionSummary?.rule.overrideSource === "vendor_override" ? "Vendor override" : "Default rule"}
            iconBg="#EFF6FF"
          />
        </div>
        <DataTable
          title="Commission History"
          description="Accruals from purchases and posted settlement credits."
          headers={["Date", "Type", "Reference", "Amount", "Rate"]}
          rows={(commissionSummary?.history.rows ?? []).map((row) => [
            formatDateTime(row.createdAt),
            row.type,
            row.reference,
            formatMoney(row.amount),
            row.rate !== null ? `${(row.rate * 100).toFixed(2)}%` : "-",
          ])}
        />
      </div>
    );
  }

  if (page.vendorView === "transactions") {
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <div style={{ marginBottom: 4 }}>
          <h1 className="vw-page-title">Transactions</h1>
          <p className="vw-page-sub">Funding, purchase, reversal, and commission movements across the wallet.</p>
        </div>

        <div className="vw-filter-pills">
          {[
            ["all", "All"],
            ["debits", "Debits"],
            ["credits", "Credits"],
            ["successful", "Successful"],
            ["failed", "Failed"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`vw-filter-pill${transactionFilter === key ? " vw-filter-pill--active" : ""}`}
              onClick={() => setTransactionFilter(key as typeof transactionFilter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="vw-surface">
          <div className="vw-surface__header">
            <span className="vw-surface__title">Transaction Table</span>
            <VwBadge variant="gray">{filteredTransactions.length} rows</VwBadge>
          </div>
          <div className="vw-table-wrap">
            <table className="vw-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance After</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((row) => (
                  <tr key={row.id}>
                    <td className="vw-td--muted">{formatDateTime(row.createdAt)}</td>
                    <td className="vw-td--mono">{row.reference ?? row.receiptNumber ?? "--"}</td>
                    <td><VwBadge variant={row.direction === "debit" ? "warning" : "success"}>{row.type}</VwBadge></td>
                    <td>{row.description}</td>
                    <td className={row.direction === "debit" ? "vw-td--danger vw-td--bold" : "vw-td--muted"}>{row.direction === "debit" ? formatMoney(row.amount) : "--"}</td>
                    <td className={row.direction === "credit" ? "vw-td--success vw-td--bold" : "vw-td--muted"}>{row.direction === "credit" ? formatMoney(row.amount) : "--"}</td>
                    <td className="vw-td--bold">{row.balanceAfter !== null ? formatMoney(row.balanceAfter) : "--"}</td>
                    <td><VwBadge variant={row.status === "failed" ? "danger" : row.status === "posted" || row.status === "successful" ? "success" : "warning"} dot>{row.status}</VwBadge></td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "var(--vw-muted)", padding: "2rem" }}>
                      No transactions match the selected filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (page.vendorView === "receipts") {
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <div style={{ marginBottom: 4 }}>
          <h1 className="vw-page-title">Receipts</h1>
          <p className="vw-page-sub">Retrieve branded receipts for past remote-send and token generation purchases.</p>
        </div>

        <div className="vw-grid-4">
          {(receipts?.rows ?? []).map((row) => (
            <Link
              key={row.id}
              to={`/vendor/buy/receipt/${row.id}`}
              className="vw-quick-card"
              style={{ minHeight: 180 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div className="vw-quick-card__icon" style={{ background: row.deliveryMethod === "remote_send" ? "#EFF6FF" : "#e6f4e6", color: row.deliveryMethod === "remote_send" ? "#2563EB" : "#008000" }}>
                  {row.deliveryMethod === "remote_send" ? "RS" : "TK"}
                </div>
                <VwBadge variant={row.deliveryMethod === "remote_send" ? "info" : "success"}>
                  {row.deliveryMethod === "remote_send" ? "Remote Send" : "Token"}
                </VwBadge>
              </div>
              <div className="vw-quick-card__title" style={{ marginBottom: 8 }}>{row.receiptNumber}</div>
              <div className="vw-quick-card__desc" style={{ marginBottom: 10 }}>{row.meterSn}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--vw-text)", marginBottom: 8 }}>{formatMoney(row.amount)}</div>
              <div style={{ fontSize: 11, color: "var(--vw-faint)" }}>{formatDateTime(row.issuedAt)}</div>
            </Link>
          ))}
        </div>

        {(receipts?.rows ?? []).length === 0 ? (
          <VwInfoBox type="info">No receipts have been issued yet.</VwInfoBox>
        ) : null}
      </div>
    );
  }

  if (page.vendorView === "topup") {
    return (
      <VendorTopUpView
        loading={submitting}
        amount={topUpAmount}
        channel={topUpChannel}
        proofFile={proofFile}
        setAmount={setTopUpAmount}
        setChannel={setTopUpChannel}
        setProofFile={setProofFile}
        onSubmit={() => void handleSubmitFundingRequest()}
      />
    );
  }

  if (page.vendorView === "topup-status") {
    const steps = ["initiated", "awaiting_proof", "under_review", "confirmed", "posted"];
    const currentStepIdx = steps.indexOf(fundingRequest?.status ?? "initiated");
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <div style={{ marginBottom: 4 }}>
          <h1 className="vw-page-title">Funding Tracker</h1>
          <p className="vw-page-sub">Track the funding request from submission to posting.</p>
        </div>
        <VwStepBar
          steps={["Initiated", "Awaiting Proof", "Under Review", "Confirmed", "Posted"]}
          current={currentStepIdx >= 0 ? currentStepIdx : 0}
        />
        {fundingRequest ? (
          <div className="vw-grid-2">
            <div className="vw-surface vw-surface--padded">
              <VwConfirmTable
                rows={[
                  { key: "Reference", value: fundingRequest.reference, mono: true },
                  { key: "Status", value: fundingRequest.status.replace(/_/g, " ") },
                  { key: "Amount", value: formatMoney(fundingRequest.amount), primary: true },
                  { key: "Channel", value: formatFundingChannelLabel(fundingRequest.channel === "cash_at_branch" ? "cash_branch" : fundingRequest.channel) },
                  { key: "Updated", value: formatDateTime(fundingRequest.updatedAt) },
                ]}
              />
            </div>

            <div className="vw-surface vw-surface--padded">
              {fundingRequest.status === "posted" ? (
                <VwInfoBox type="success">
                  Funding has been posted to the wallet. No token is issued for funding, so the next step is to use Buy Units whenever the customer is ready.
                </VwInfoBox>
              ) : fundingRequest.status === "under_review" || fundingRequest.status === "confirmed" ? (
                <VwInfoBox type="info">
                  Finance is currently reviewing the transfer proof and preparing the wallet credit journal.
                </VwInfoBox>
              ) : (
                <VwInfoBox type="warning">
                  Awaiting the next funding step. Keep the funding reference handy in case finance requests verification.
                </VwInfoBox>
              )}

              <VwDivider label="NEXT ACTION" />
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  fundingRequest.status === "posted"
                    ? "Open Buy Units to generate a token or remote-send from the funded balance."
                    : "Wait for finance to complete proof review and post the wallet credit.",
                  "Funding increases wallet balance only; electricity tokens are created separately during purchases.",
                  `Reference ${fundingRequest.reference} remains your primary support handle for this request.`,
                ].map((line) => (
                  <div key={line} style={{ fontSize: 12, color: "var(--vw-muted)", lineHeight: 1.7 }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <VwInfoBox type="warning">Funding request not found.</VwInfoBox>
        )}
      </div>
    );
  }

  if (page.vendorView === "statement") {
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <div style={{ marginBottom: 4 }}>
          <h1 className="vw-page-title">Statement</h1>
          <p className="vw-page-sub">Select a period, preview statement lines, and download the current view.</p>
        </div>

        <div className="vw-surface vw-surface--padded">
          <div className="vw-grid-4" style={{ gridTemplateColumns: "1.2fr 1.2fr 0.8fr auto" }}>
            <div className="vw-field">
              <label className="vw-field__label">From date</label>
              <input
                type="date"
                value={statementRange.fromDate}
                onChange={(event) => setStatementRange((current) => ({ ...current, fromDate: event.target.value }))}
                style={{ width: "100%", padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", fontFamily: "var(--vw-font)", fontSize: 13 }}
              />
            </div>
            <div className="vw-field">
              <label className="vw-field__label">To date</label>
              <input
                type="date"
                value={statementRange.toDate}
                onChange={(event) => setStatementRange((current) => ({ ...current, toDate: event.target.value }))}
                style={{ width: "100%", padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", fontFamily: "var(--vw-font)", fontSize: 13 }}
              />
            </div>
            <div className="vw-field">
              <label className="vw-field__label">Format</label>
              <select
                value={statementFormat}
                onChange={(event) => setStatementFormat(event.target.value as typeof statementFormat)}
                style={{ width: "100%", padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", fontFamily: "var(--vw-font)", fontSize: 13 }}
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "end" }}>
              <VwBtn
                variant="primary"
                onClick={() => downloadStatementPreview(statement?.rows ?? [], statementRange.fromDate, statementRange.toDate, statementFormat)}
              >
                Download
              </VwBtn>
            </div>
          </div>
        </div>

        <div className="vw-surface">
          <div className="vw-surface__header">
            <span className="vw-surface__title">Statement Preview</span>
            <VwBadge variant="gray">{statement?.total ?? 0} rows</VwBadge>
          </div>
          <div className="vw-table-wrap">
            <table className="vw-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {(statement?.rows ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="vw-td--muted">{formatDateTime(row.createdAt)}</td>
                    <td className="vw-td--mono">{row.reference}</td>
                    <td>{row.description}</td>
                    <td className={row.debit > 0 ? "vw-td--danger vw-td--bold" : "vw-td--muted"}>{row.debit > 0 ? formatMoney(row.debit) : "--"}</td>
                    <td className={row.credit > 0 ? "vw-td--success vw-td--bold" : "vw-td--muted"}>{row.credit > 0 ? formatMoney(row.credit) : "--"}</td>
                    <td className="vw-td--bold">{formatMoney(row.balanceAfter)}</td>
                  </tr>
                ))}
                {(statement?.rows ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--vw-muted)", padding: "2rem" }}>
                      No statement rows are available for the selected period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <div className="vw-surface vw-surface--padded" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="vw-spinner vw-spinner--md" style={{ borderColor: "var(--vw-primary)", borderRightColor: "transparent", marginBottom: 12 }} />
          <p style={{ color: "var(--vw-muted)", fontSize: 13 }}>Loading vendor profile…</p>
        </div>
      </div>
    );
  }

  const onboardingRequired = !profile.wallet || profile.vendor.status !== "active";

  return onboardingRequired ? (
    <VendorOnboardingView
      profile={profile}
      form={onboardingForm}
      setForm={setOnboardingForm}
      submitting={submitting}
      feedback={profileFeedback}
      onSubmit={() => void handleSubmitOnboarding()}
    />
  ) : (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 className="vw-page-title">Vendor Profile</h1>
        <p className="vw-page-sub">Grouped identity, contact, wallet, and KYC information for the current vendor account.</p>
      </div>
      {profile ? (
        <>
          <div className="vw-grid-4">
            <VwKPI label="Wallet Status" value={profile.wallet?.status ?? "Pending"} sub={profile.wallet?.walletNumber ?? "Wallet pending"} iconBg="#EFF6FF" />
            <VwKPI label="Available Balance" value={formatMoney(profile.wallet?.availableBalance ?? 0)} sub="Current posted balance" iconBg="#e6f4e6" />
            <VwKPI label="Reserved" value={formatMoney(profile.wallet?.reservedBalance ?? 0)} sub="Pending purchases" iconBg="#FFFBEB" />
            <VwKPI label="KYC Documents" value={profile.vendor.kycDocumentCount ?? 0} sub={profile.vendor.kycStatus ?? "Not started"} iconBg="#F5F3FF" />
          </div>
          <div className="vw-profile-section">
            <div className="vw-profile-section__header">Account Information</div>
            {[
              ["Vendor", profile.vendor.businessName ?? profile.vendor.vendorCode ?? "Vendor account"],
              ["Legal Name", profile.vendor.legalName ?? "Not provided"],
              ["Wallet Number", profile.wallet?.walletNumber ?? "Wallet pending"],
              ["Site", profile.vendor.siteName ?? "Site pending"],
              ["Registration Number", profile.vendor.registrationNumber ?? "Not provided"],
              ["Tax ID", profile.vendor.taxId ?? "Not provided"],
            ].map(([k, v]) => (
              <div className="vw-profile-row" key={k}>
                <span className="vw-profile-row__key">{k}</span>
                <span className="vw-profile-row__val">{v}</span>
              </div>
            ))}
          </div>
          <div className="vw-profile-section">
            <div className="vw-profile-section__header">Contact Details</div>
            {[
              ["Contact Name", profile.vendor.contactName ?? "Not provided"],
              ["Contact Email", profile.vendor.contactEmail ?? "Not provided"],
              ["Contact Phone", profile.vendor.contactPhone ?? "Not provided"],
              ["Alternate Contact", profile.vendor.alternateContactName ?? "Not provided"],
              ["Alternate Phone", profile.vendor.alternateContactPhone ?? "Not provided"],
              ["Business Address", profile.vendor.businessAddress ?? "Not provided"],
            ].map(([k, v]) => (
              <div className="vw-profile-row" key={k}>
                <span className="vw-profile-row__key">{k}</span>
                <span className="vw-profile-row__val">{v}</span>
              </div>
            ))}
          </div>
          <div className="vw-profile-section">
            <div className="vw-profile-section__header">KYC Status</div>
            {[
              ["Wallet Status", profile.wallet?.status ?? "Pending"],
              ["KYC Status", profile.vendor.kycStatus ?? "Not started"],
              ["Onboarding Submitted", profile.vendor.onboardingSubmittedAt ? formatDateTime(profile.vendor.onboardingSubmittedAt) : "Not submitted"],
              ["Bank", profile.vendor.bankName ?? "Not provided"],
              ["Account Name", profile.vendor.accountName ?? "Not provided"],
              ["Masked Account", profile.vendor.accountNumberMasked ?? "Not provided"],
            ].map(([k, v]) => (
              <div className="vw-profile-row" key={k}>
                <span className="vw-profile-row__key">{k}</span>
                <span className={`vw-profile-row__val${v === "active" || v === "approved" ? " vw-profile-row__val--success" : ""}`}>{v}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default VendorPage;
