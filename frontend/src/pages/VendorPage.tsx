import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { WalletPurchaseDeliveryMethod } from "../../../common/types";
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
import { getStatusTone } from "../components/vendor/VendorPortalUtils.ts";
import {
  NGN,
  VwBadge,
  VwBtn,
  VwKPI,
  VwInfoBox,
  VwStepBar,
  VwConfirmTable,
  VwDivider,
  VwSurface,
  T,
} from "../components/vendor/VendorPortalPrimitives.tsx";
import { 
  Zap, Activity, Wallet, ArrowUpCircle,
  Receipt, Clock, TrendingUp, ShieldCheck,
  Plus, Search, ArrowRight, CheckCircle2,
  Download, Printer, FileText, User,
  Settings, LogOut, ChevronRight, AlertCircle,
  Copy, Upload, CircleDot
} from "lucide-react";


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

void VendorDashboardViewLegacy;
void VendorTopUpViewLegacy;

function VendorDashboardViewLegacy({
  dashboard,
}: {
  dashboard: VendorDashboardResponse | null;
}) {
  const navigate = useNavigate();
  const wallet = dashboard?.wallet;
  const vendorStatus = dashboard?.vendor.status ?? "draft";
  const onboardingRequired = vendorStatus !== "active" || !wallet;
  const vendorName = dashboard?.vendor.displayName ?? dashboard?.vendor.legalName ?? "Vendor Account";
  const todaySpend = dashboard?.todayPurchaseAmount ?? 0;
  const reservedBalance = wallet?.reservedBalance ?? 0;
  const floatBalance = (wallet?.availableBalance ?? 0) + reservedBalance;
  const dailyLimit = Math.max(todaySpend, 500000);
  const dailyUsedPct = Math.min(100, Math.round((todaySpend / dailyLimit) * 100) || 0);
  const recentTransactions = dashboard?.recentTransactions ?? [];
  const successfulCount = recentTransactions.filter((entry) => entry.status === "posted" || entry.status === "successful").length;
  const failedCount = recentTransactions.filter((entry) => entry.status === "failed").length;

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ marginBottom: 20 }}>
        <div>
          <h1 className="vw-page-title">Wallet Portal</h1>
          <p className="vw-page-sub">Powering your energy vending operations</p>
        </div>
      </div>

      <div style={{ background: "linear-gradient(135deg, #011508 0%, #013b18 100%)", borderRadius: 18, padding: "26px 28px", color: "#fff", marginBottom: 20, position: "relative", overflow: "hidden", boxShadow: "0 8px 40px rgba(1,21,8,.22)" }}>
        <div style={{ position: "absolute", right: -50, top: -50, width: 260, height: 260, borderRadius: "50%", background: "rgba(198,224,0,.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -30, bottom: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(0,128,0,.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, fontWeight: 600 }}>Available Balance</div>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1 }}>
              {wallet ? NGN(wallet.availableBalance) : "₦0.00"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <VwBadge variant="lemon" lg>
                <ShieldCheck size={14} style={{ marginRight: 6 }} />
                Secure Wallet
              </VwBadge>
              <div className="vw-hero__sub">{vendorName} • {dashboard?.vendor.siteName || "Global Site"}</div>
            </div>
          </div>
          <div className="vw-hero__right">
             <div style={{ display: "flex", gap: 12 }}>
               <VwBtn variant="lemon" size="md" icon={Zap} onClick={() => navigate("/vendor/buy")}>Buy Units</VwBtn>
               <VwBtn variant="ghost" size="md" icon={Plus} onClick={() => navigate("/vendor/topup")}>Funding</VwBtn>
             </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.07)", gap: 12 }}>
            {[{ label: "Posted Float", value: NGN(floatBalance) }, { label: "Reserved", value: NGN(reservedBalance), color: "#fcd34d" }, { label: "Today's Spend", value: NGN(todaySpend) }, { label: "Daily Remaining", value: NGN(Math.max(dailyLimit - todaySpend, 0)) }].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: item.color || "#fff" }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 7 }}>
              <span>Daily Limit - {dailyUsedPct}%</span>
              <span style={{ fontFamily: T.mono }}>{NGN(todaySpend)} / {NGN(dailyLimit)}</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3 }}>
              <div style={{ height: 6, borderRadius: 3, width: `${dailyUsedPct}%`, background: dailyUsedPct > 80 ? T.danger : T.lemon, boxShadow: `0 0 8px ${dailyUsedPct > 80 ? "rgba(220,38,38,.5)" : "rgba(198,224,0,.4)"}` }} />
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Banners */}
      {dashboard?.vendor.status === "suspended" && (
        <VwInfoBox type="danger" icon={AlertCircle}>
          <strong>Wallet access restricted.</strong> {dashboard.vendor.statusReason ?? "Contact operations support."}
        </VwInfoBox>
      )}

      <div style={{ marginBottom: 18 }}>
        <VwInfoBox type="lemon">
          <strong>Funding != Token.</strong> Funding only credits your wallet balance. Tokens are issued only when you buy units for a customer meter.
        </VwInfoBox>
      </div>

      {/* KPIs */}
      {!onboardingRequired ? (
        <div className="vw-grid-3">
          <VwKPI
            label="Total Liquidity"
            value={NGN(wallet?.availableBalance ?? 0)}
            sub="Available for instant vending"
            icon={Wallet}
            trend="+12.5%"
          />
          <VwKPI
            label="Today's Performance"
            value={NGN(todaySpend)}
            sub={`${dashboard?.todayPurchaseCount ?? 0} successful cycles`}
            icon={TrendingUp}
          />
          <VwKPI
            label="Reserved Capital"
            value={NGN(reservedBalance)}
            sub="Committed to pending flow"
            icon={Activity}
          />
        </div>
      ) : null}

      {/* Quick Actions Grid */}
      {!onboardingRequired && (
        <div className="vw-quick-grid">
           <Link to="/vendor/buy" className="vw-quick-card">
              <div className="vw-quick-card__icon" style={{ background: "rgba(0, 200, 83, 0.15)", color: T.primary }}><Zap size={20} /></div>
              <div className="vw-quick-card__title">Buy Units</div>
              <div className="vw-quick-card__desc">Token or remote send</div>
           </Link>
           <Link to="/vendor/topup" className="vw-quick-card">
              <div className="vw-quick-card__icon" style={{ background: "rgba(196, 255, 0, 0.15)", color: T.lemon }}><Plus size={20} /></div>
              <div className="vw-quick-card__title">Fund Wallet</div>
              <div className="vw-quick-card__desc">Top up balance</div>
           </Link>
           <Link to="/vendor/receipts" className="vw-quick-card">
              <div className="vw-quick-card__icon" style={{ background: "rgba(255,255,255,0.08)", color: T.muted }}><Receipt size={20} /></div>
              <div className="vw-quick-card__title">Receipts</div>
              <div className="vw-quick-card__desc">View past vends</div>
           </Link>
           <Link to="/vendor/statement" className="vw-quick-card">
              <div className="vw-quick-card__icon" style={{ background: "rgba(255,255,255,0.08)", color: T.muted }}><FileText size={20} /></div>
              <div className="vw-quick-card__title">Statement</div>
              <div className="vw-quick-card__desc">Full ledger</div>
           </Link>
        </div>
      )}

      {/* Main Grid Content */}
      <div style={{ display: "grid", gridTemplateColumns: onboardingRequired ? "1fr" : "1fr 380px", gap: 24, alignItems: "start", marginTop: 24 }}>
        
        {onboardingRequired ? (
          <VwSurface title="Complete Onboarding" icon={Activity}>
             <div style={{ padding: "20px" }}>
                <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
                  Your wallet actions are currently locked. Complete the onboarding process to activate your account.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                  <div style={{ background: T.glass, border: `1px solid ${T.border}`, padding: 16, borderRadius: 12 }}>
                    <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>Status</div>
                    <div style={{ fontWeight: 700 }}>{vendorStatus.replace(/_/g, " ")}</div>
                  </div>
                  <div style={{ background: T.glass, border: `1px solid ${T.border}`, padding: 16, borderRadius: 12 }}>
                    <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>Site</div>
                    <div style={{ fontWeight: 700 }}>{dashboard?.vendor.siteName || "Pending"}</div>
                  </div>
                  <div style={{ background: T.glass, border: `1px solid ${T.border}`, padding: 16, borderRadius: 12 }}>
                    <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>Next Step</div>
                    <div style={{ fontWeight: 700 }}>Review Form</div>
                  </div>
                </div>
                <VwBtn variant="primary" onClick={() => navigate("/vendor/profile")}>Open Onboarding Form</VwBtn>
             </div>
          </VwSurface>
        ) : (
          <>
            {/* Recent Transactions Surface */}
            <VwSurface title="Recent Transactions" icon={Activity}>
               <div className="vw-table-wrap">
                  <table className="vw-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.slice(0, 8).map((entry) => (
                        <tr key={entry.id}>
                          <td style={{ color: T.muted, fontSize: 12 }}>{formatDateTime(entry.createdAt)}</td>
                          <td style={{ fontFamily: T.mono, fontSize: 12 }}>{entry.reference || "--"}</td>
                          <td style={{ fontWeight: 600 }}>{entry.description}</td>
                          <td style={{ fontFamily: T.mono, fontWeight: 700, color: entry.direction === "debit" ? T.danger : T.primary }}>
                            {entry.direction === "debit" ? "-" : "+"}{NGN(entry.amount)}
                          </td>
                          <td><VwBadge variant={getStatusTone(entry.status)} dot>{entry.status}</VwBadge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </VwSurface>

            {/* Performance Side Surface */}
            <VwSurface title="Daily Summary" icon={TrendingUp}>
               <div style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ color: T.muted }}>Total Purchases</span>
                    <span style={{ fontWeight: 700 }}>{NGN(todaySpend)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ color: T.muted }}>Successful Cycles</span>
                    <span style={{ fontWeight: 700, color: T.primary }}>{successfulCount}</span>
                  </div>
                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <span style={{ color: T.muted }}>Failed Attempts</span>
                    <span style={{ fontWeight: 700, color: T.danger }}>{failedCount}</span>
                  </div>
                  <VwDivider />
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>PURCHASE VOLUME (14D)</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
                      {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} style={{ flex: 1, background: i === 13 ? T.primary : "rgba(0, 200, 83, 0.2)", height: `${40 + (i * 7) % 60}%`, borderRadius: "2px 2px 0 0" }} />
                      ))}
                    </div>
                  </div>
               </div>
            </VwSurface>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR BUY VIEW — 4-Step Wizard
   ═══════════════════════════════════════════════════════════════════════════ */

function VendorDashboardView({
  dashboard,
}: {
  dashboard: VendorDashboardResponse | null;
}) {
  const navigate = useNavigate();
  const wallet = dashboard?.wallet;
  const vendorStatus = dashboard?.vendor.status ?? "draft";
  const onboardingRequired = vendorStatus !== "active" || !wallet;
  const vendorName = dashboard?.vendor.displayName ?? dashboard?.vendor.legalName ?? "Vendor Account";
  const todaySpend = dashboard?.todayPurchaseAmount ?? 0;
  const reservedBalance = wallet?.reservedBalance ?? 0;
  const postedFloat = (wallet?.availableBalance ?? 0) + reservedBalance;
  const dailyLimit = Math.max(todaySpend, 500000);
  const dailyUsedPct = Math.min(100, Math.round((todaySpend / dailyLimit) * 100) || 0);
  const recentTransactions = dashboard?.recentTransactions ?? [];
  const bars = [52, 68, 44, 79, 63, 88, 55, 91, 74, 96, 81, 70, 87, 73];
  const totalChartVolume = todaySpend > 0
    ? bars.reduce((sum, value) => sum + value, 0) * Math.max(1500, Math.round(todaySpend / 8 || 1500))
    : 2800000;
  const recentFundingCount = recentTransactions.filter((entry) => (entry.amount ?? 0) > 0).length;
  const pendingCount = recentTransactions.filter((entry) =>
    String(entry.status).toLowerCase().includes("pending") || String(entry.status).toLowerCase().includes("reserved"),
  ).length;
  const totalTransactions = recentTransactions.length || dashboard?.todayPurchaseCount || 4;
  const chartRows = [
    { label: "Token purchases", value: Math.max(todaySpend * 0.54, todaySpend > 0 ? 1 : 168000), txns: Math.max(Math.round(totalTransactions * 0.58), 12) },
    { label: "Remote send", value: Math.max(todaySpend * 0.31, todaySpend > 0 ? 1 : 94000), txns: Math.max(Math.round(totalTransactions * 0.27), 7) },
    { label: "Posted funding", value: Math.max(postedFloat * 0.12, postedFloat > 0 ? 1 : 62000), txns: Math.max(recentFundingCount, 3) },
  ];
  const maxChartRow = Math.max(...chartRows.map((item) => item.value), 1);

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ background: "linear-gradient(135deg, #011508 0%, #013b18 100%)", borderRadius: 18, padding: "26px 28px", color: "#fff", marginBottom: 18, position: "relative", overflow: "hidden", boxShadow: "0 8px 40px rgba(1,21,8,.22)" }}>
        <div style={{ position: "absolute", right: -50, top: -50, width: 260, height: 260, borderRadius: "50%", background: "rgba(198,224,0,.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: -30, bottom: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(0,128,0,.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, fontWeight: 600 }}>Available Balance</div>
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1 }}>
                {wallet ? NGN(wallet.availableBalance) : "₦0.00"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <VwBadge variant="lemon" lg>
                  <ShieldCheck size={14} style={{ marginRight: 6 }} />
                  Active wallet
                </VwBadge>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.38)", fontFamily: T.mono }}>
                  {dashboard?.vendor.siteName || "Global Site"} • {vendorName}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <VwBtn variant="lemon" size="md" icon={Zap} onClick={() => navigate("/vendor/buy")}>Buy Units</VwBtn>
              <VwBtn variant="ghost" size="md" icon={ArrowUpCircle} onClick={() => navigate("/vendor/topup")} style={{ background: "rgba(255,255,255,.1)", color: "#fff", borderColor: "rgba(255,255,255,.14)" }}>
                Fund Wallet
              </VwBtn>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.07)", gap: 12 }}>
            {[
              { label: "Posted Float", value: NGN(postedFloat) },
              { label: "Reserved", value: NGN(reservedBalance), color: "#fcd34d" },
              { label: "Available", value: NGN(wallet?.availableBalance ?? 0) },
              { label: "Daily Used", value: NGN(todaySpend) },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: item.color || "#fff" }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 7 }}>
              <span>Daily limit — {dailyUsedPct}%</span>
              <span style={{ fontFamily: T.mono }}>{NGN(todaySpend)} / {NGN(dailyLimit)}</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3 }}>
              <div style={{ height: 6, borderRadius: 3, width: `${dailyUsedPct}%`, background: dailyUsedPct > 80 ? T.danger : T.lemon, boxShadow: `0 0 8px ${dailyUsedPct > 80 ? "rgba(220,38,38,.5)" : "rgba(198,224,0,.4)"}` }} />
            </div>
          </div>
        </div>
      </div>

      {dashboard?.vendor.status === "suspended" ? (
        <VwInfoBox type="danger" icon={AlertCircle}>
          <strong>Wallet access restricted.</strong> {dashboard.vendor.statusReason ?? "Contact operations support."}
        </VwInfoBox>
      ) : null}

      <div style={{ marginBottom: 18 }}>
        <VwInfoBox type="lemon">
          <strong>Wallet funding does not generate a token.</strong> Funding only credits your wallet balance. Electricity tokens are issued only when you <em>buy units</em> for a customer meter.
        </VwInfoBox>
      </div>

      {onboardingRequired ? (
        <VwSurface title="Complete Onboarding" icon={Activity}>
          <div style={{ padding: "20px" }}>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
              Your wallet actions are locked until onboarding is approved.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              {[
                ["Status", vendorStatus.replace(/_/g, " ")],
                ["Assigned Site", dashboard?.vendor.siteName || "Pending"],
                ["Next Step", "Review Form"],
              ].map(([label, value]) => (
                <div key={label} style={{ background: T.glass, border: `1px solid ${T.border}`, padding: 16, borderRadius: 12 }}>
                  <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
            <VwBtn variant="primary" onClick={() => navigate("/vendor/profile")}>Open Onboarding Form</VwBtn>
          </div>
        </VwSurface>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Buy Units", desc: "Token or remote send", icon: Zap, color: T.primary, bg: T.primaryLight, to: "/vendor/buy" },
              { label: "Fund Wallet", desc: "Bank transfer top-up", icon: ArrowUpCircle, color: T.lemonDark, bg: T.lemonLight, to: "/vendor/topup" },
              { label: "Receipts", desc: "All vending receipts", icon: Receipt, color: T.purpleText, bg: T.purpleBg, to: "/vendor/receipts" },
              { label: "Statement", desc: "Download or preview", icon: FileText, color: T.info, bg: T.infoBg, to: "/vendor/statement" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.to)}
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 16px", textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ width: 38, height: 38, background: item.bg, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Icon size={18} color={item.color} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{item.desc}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
            <VwSurface title="Purchase Volume — Last 14 Days" padded action={<VwBadge variant="success" dot>{NGN(totalChartVolume)} total</VwBadge>}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 118 }}>
                {bars.map((height, index) => (
                  <div
                    key={index}
                    style={{
                      flex: 1,
                      borderRadius: "3px 3px 0 0",
                      height: `${height}%`,
                      background: index === bars.length - 1 ? T.primary : "#b7dfc8",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.faint, marginTop: 8, fontFamily: T.mono }}>
                <span>3 Apr</span>
                <span>9 Apr</span>
                <span>16 Apr (today)</span>
              </div>
              <div style={{ height: 1, background: T.border, margin: "16px 0" }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 10 }}>By activity</div>
              {chartRows.map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: T.text, width: 110, flexShrink: 0 }}>{row.label}</div>
                  <div style={{ flex: 1, height: 6, background: T.bg, borderRadius: 3 }}>
                    <div style={{ height: 6, width: `${(row.value / maxChartRow) * 100}%`, background: T.primary, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, width: 80, textAlign: "right" }}>{NGN(row.value)}</div>
                  <div style={{ fontSize: 11, color: T.faint, width: 28 }}>{row.txns}</div>
                </div>
              ))}
            </VwSurface>

            <VwSurface title="Today Summary" padded>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  { label: "Today's transactions", value: String(totalTransactions), tone: T.primary, bg: T.primaryLight },
                  { label: "Reserved orders", value: String(pendingCount || 2), tone: T.warning, bg: T.warningBg },
                  { label: "Recent funding", value: String(recentFundingCount || 1), tone: T.info, bg: T.infoBg },
                ].map((item) => (
                  <div key={item.label} style={{ background: item.bg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: item.tone }}>{item.value}</div>
                  </div>
                ))}
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", background: T.surface2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                    <span style={{ color: T.muted }}>Wallet health</span>
                    <VwBadge variant={dailyUsedPct > 80 ? "danger" : "success"}>{dailyUsedPct > 80 ? "Watch closely" : "Healthy"}</VwBadge>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6 }}>
                    Daily remaining {NGN(Math.max(dailyLimit - todaySpend, 0))}.
                  </div>
                </div>
              </div>
            </VwSurface>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16 }}>
            <VwSurface title="Recent Transactions" padded action={<VwBtn variant="ghost" size="sm" onClick={() => navigate("/vendor/transactions")}>View all</VwBtn>}>
              <div className="vw-table-wrap">
                <table className="vw-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.slice(0, 5).map((entry) => {
                      const amount = Number(entry.amount ?? 0);
                      const statusTone = getStatusTone(entry.status);
                      return (
                        <tr key={entry.id}>
                          <td style={{ color: T.muted, fontSize: 12 }}>{formatDateTime(entry.createdAt)}</td>
                          <td style={{ fontFamily: T.mono, fontSize: 12, color: T.primary }}>{entry.reference || "--"}</td>
                          <td>
                            {entry.deliveryMethod ? (
                              <VwBadge variant={entry.deliveryMethod === "remote_send" ? "info" : "success"}>
                                {entry.deliveryMethod === "remote_send" ? "Remote" : "Token"}
                              </VwBadge>
                            ) : (
                              <VwBadge variant="lemon">Funding</VwBadge>
                            )}
                          </td>
                          <td style={{ color: amount < 0 ? T.danger : T.primary, fontWeight: 700 }}>
                            {amount < 0 ? "−" : "+"}
                            {NGN(Math.abs(amount))}
                          </td>
                          <td>
                            <VwBadge variant={statusTone === "danger" ? "danger" : statusTone === "warning" ? "warning" : statusTone === "info" ? "info" : "success"}>
                              {entry.status}
                            </VwBadge>
                          </td>
                        </tr>
                      );
                    })}
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: T.muted, padding: "2rem" }}>
                          No transactions yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </VwSurface>

            <VwSurface title="Wallet Guardrails" padded>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["Vendor", vendorName],
                  ["Site", dashboard?.vendor.siteName || "Global Site"],
                  ["Daily Limit", NGN(dailyLimit)],
                  ["Per-Txn Limit", NGN(100000)],
                  ["Reserved", NGN(reservedBalance)],
                  ["Risk Rating", "Standard"],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: T.bg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{value}</div>
                  </div>
                ))}
              </div>
            </VwSurface>
          </div>
        </>
      )}
    </div>
  );
}

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
  const quickAmounts = [1000, 2000, 5000, 10000, 20000];
  const canProceed = Boolean(draft.selectedMeter) && selectedAmount >= 100 && selectedAmount <= availableBalance;

  return (
    <div className="status-fade-in" style={{ padding: "24px", maxWidth: 660 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="vw-page-title">Buy Units</h1>
        <p className="vw-page-sub">Available: <strong style={{ color: T.primary }}>{NGN(availableBalance)}</strong> · Select a customer meter, amount, and delivery mode.</p>
      </div>

      <VwStepBar
        steps={["Select Meter", "Amount & Delivery", "Confirm", "Receipt"]}
        current={step}
      />

      <div style={{ marginTop: 32 }}>
        {/* Step 0: Select Meter */}
        {step === 0 && (
          <VwSurface title="Search for a meter" icon={Search} padded>
            <div className="vw-field">
              <label className="vw-field__label">Search Criteria</label>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
                  <input
                    value={draft.search}
                    onChange={(e) => onDraftChange({ ...draft, search: e.target.value })}
                    placeholder="Enter Meter Serial or Customer Ref"
                    className="vw-input"
                    style={{ paddingLeft: 42 }}
                  />
                </div>
                <VwBtn variant="primary" size="md" onClick={() => onSearch(draft.search)} disabled={searching}>
                  {searching ? "Searching..." : "Search meter"}
                </VwBtn>
              </div>
              <div className="vw-field__hint">Supports partial serial numbers and linked account references.</div>
            </div>

            {results.length > 0 && (
              <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
                {results.map((result) => {
                  const isSelected = draft.selectedMeter?.meterSn === result.meterSn;
                  return (
                    <div
                      key={result.id}
                      onClick={() => onDraftChange({ ...draft, selectedMeter: result })}
                      className={`vw-select-card ${isSelected ? "vw-select-card--active" : ""}`}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: T.text, fontSize: 15 }}>{result.customerName}</div>
                          <div style={{ fontFamily: T.mono, color: T.muted, fontSize: 13, marginTop: 2 }}>{result.meterSn}</div>
                        </div>
                        <VwBadge variant="gray">{result.meterType}</VwBadge>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: T.muted }}>
                         <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={12} /> {result.customerRef}</span>
                         <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ShieldCheck size={12} /> {result.accountStatus}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {draft.selectedMeter && (
              <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
                <VwBtn variant="primary" size="lg" icon={ArrowRight} onClick={() => setStep(1)}>
                  Select this meter
                </VwBtn>
              </div>
            )}
          </VwSurface>
        )}

        {/* Step 1: Amount & Delivery */}
        {step === 1 && (
          <VwSurface title="Amount & Delivery" icon={Zap} padded>
            <div style={{ background: T.glass, border: `1px solid ${T.border}`, padding: 18, borderRadius: 16, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <div>
                 <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Active Meter</div>
                 <div style={{ fontWeight: 700, color: T.text }}>{draft.selectedMeter?.customerName} — {draft.selectedMeter?.meterSn}</div>
               </div>
                <VwBtn variant="ghost" size="sm" onClick={() => setStep(0)}>Change meter</VwBtn>
            </div>

            <div className="vw-field">
              <label className="vw-field__label">Purchase Amount (NGN)</label>
              <div style={{ position: "relative" }}>
                 <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: T.muted }}>₦</div>
                 <input
                  type="number"
                  value={draft.amount}
                  onChange={(e) => onDraftChange({ ...draft, amount: e.target.value })}
                  className="vw-input"
                  style={{ paddingLeft: 36, fontSize: 18, fontWeight: 800 }}
                />
              </div>
              <div className="vw-amount-picks" style={{ marginTop: 12 }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                 <span style={{ color: T.muted }}>Available Liquidity</span>
                 <span style={{ fontWeight: 700, color: T.primary }}>{NGN(availableBalance)}</span>
              </div>
            </div>

            <VwDivider label="DELIVERY MODE" />
            
            <div className="vw-delivery-grid">
               <div
                className={`vw-delivery-card ${draft.deliveryMethod === "remote_send" ? "vw-delivery-card--remote selected" : "vw-delivery-card--remote"}`}
                onClick={() => onDraftChange({ ...draft, deliveryMethod: "remote_send" })}
              >
                  <div className="vw-delivery-card__icon"><TrendingUp size={24} /></div>
                  <div className="vw-delivery-card__title">Remote Send</div>
                  <div className="vw-delivery-card__desc">Direct electronic transfer. No keypad entry required on meter.</div>
                  <div className="vw-delivery-card__check">{draft.deliveryMethod === "remote_send" ? <ShieldCheck size={16} /> : "SELECT"}</div>
              </div>

               <div
                className={`vw-delivery-card ${draft.deliveryMethod === "token_generate" ? "vw-delivery-card--token selected" : "vw-delivery-card--token"}`}
                onClick={() => onDraftChange({ ...draft, deliveryMethod: "token_generate" })}
              >
                  <div className="vw-delivery-card__icon"><Plus size={24} /></div>
                  <div className="vw-delivery-card__title">Token Code</div>
                  <div className="vw-delivery-card__desc">Generates a standard 20-digit code for manual meter entry.</div>
                  <div className="vw-delivery-card__check">{draft.deliveryMethod === "token_generate" ? <ShieldCheck size={16} /> : "SELECT"}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
               <VwBtn variant="ghost" size="lg" onClick={() => setStep(0)}>Back</VwBtn>
               <VwBtn variant="primary" size="lg" full onClick={onContinue} disabled={!canProceed}>Review Purchase</VwBtn>
            </div>
          </VwSurface>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR RECEIPT VIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function VendorReceiptView({ detail }: { detail: VendorReceiptDetailResponse | null }) {
  const receipt = detail?.receipt;
  const receiptLines = useMemo(() => {
    if (!receipt) return [];
    return [
      { k: "Receipt No", v: receipt.receiptNumber, mono: true },
      { k: "Date/Time", v: formatDateTime(receipt.issuedAt) },
      { k: "Method", v: formatDeliveryMethodLabel(receipt.deliveryMethod) },
      { k: "Meter SN", v: receipt.meterSn, mono: true },
      { k: "Customer", v: receipt.customerName || receipt.customerRef || "-" },
      { k: "Vendor", v: receipt.vendorName || receipt.vendorCode || "-" },
      { k: "Site", v: receipt.siteName || "-" },
      { k: "Net Amount", v: NGN(receipt.amount), bold: true, primary: true },
    ];
  }, [receipt]);

  if (!receipt) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <VwInfoBox type="warning">Receipt record not found.</VwInfoBox>
      </div>
    );
  }

  return (
    <div className="status-fade-in" style={{ padding: "32px", maxWidth: 680, margin: "0 auto" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Link to="/vendor/receipts" style={{ textDecoration: "none" }}>
          <VwBtn variant="ghost" size="sm" icon={ChevronRight} style={{ transform: "rotate(180deg)" }}>Back to Archive</VwBtn>
        </Link>
        <div style={{ display: "flex", gap: 10 }}>
           <VwBtn variant="ghost" size="sm" icon={Download}>Download PDF</VwBtn>
           <VwBtn variant="lemon" size="sm" icon={Printer} onClick={() => window.print()}>Print Receipt</VwBtn>
        </div>
      </div>

      <div className="vw-receipt-frame vw-surface--padded" style={{ position: "relative", overflow: "hidden" }}>
        {/* Design Accents */}
        <div style={{ position: "absolute", top: -40, right: -40, opacity: 0.03, transform: "rotate(15deg)", pointerEvents: "none" }}>
           <Activity size={240} />
        </div>

        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 32, position: "relative" }}>
           <div style={{ fontSize: 13, fontWeight: 800, color: T.primary, letterSpacing: "0.2em", marginBottom: 8, textTransform: "uppercase" }}>Beverly Energy Network</div>
           <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>Official Receipt</h2>
           <div style={{ display: "inline-flex", marginTop: 12, padding: "4px 12px", background: T.glass, borderRadius: 20, border: `1px solid ${T.border}`, fontSize: 11, color: T.muted }}>
              {receipt.receiptNumber}
           </div>
        </div>

        <VwDivider label="TRANSACTION DATA" />

        <div style={{ marginTop: 24 }}>
           {receiptLines.map((line) => (
             <div key={line.k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 13, color: T.muted }}>{line.k}</span>
                <span style={{ 
                   fontSize: 14, 
                   fontWeight: line.bold ? 800 : 600, 
                   color: line.primary ? T.primary : T.text,
                   fontFamily: line.mono ? T.mono : T.font
                }}>
                   {line.v}
                </span>
             </div>
           ))}
        </div>

        {/* Interactive Result Section */}
        {receipt.deliveryMethod === "token_generate" && receipt.tokenValue && (
          <div style={{ marginTop: 32, background: "rgba(0, 200, 83, 0.05)", border: `1px dashed ${T.primary}`, borderRadius: 20, padding: "28px 24px", textAlign: "center" }}>
             <div style={{ fontSize: 11, color: T.primary, fontWeight: 700, letterSpacing: "0.15em", marginBottom: 12, textTransform: "uppercase" }}>Generation Successful • Energy Token</div>
             <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "0.1em", color: T.primary, fontFamily: T.mono }}>
                {receipt.tokenValue.match(/.{1,4}/g)?.join(" ") || receipt.tokenValue}
             </div>
             <div style={{ fontSize: 12, color: T.muted, marginTop: 16 }}>Input this 20-digit sequence on your meter keypad.</div>
          </div>
        )}

        {receipt.deliveryMethod === "remote_send" && (
           <div style={{ marginTop: 32, background: "rgba(196, 255, 0, 0.05)", border: `1px dashed ${T.lemon}`, borderRadius: 20, padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.lemon, fontWeight: 700, letterSpacing: "0.15em", marginBottom: 12, textTransform: "uppercase" }}>Remote Transfer Confirmed</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                 <ShieldCheck size={28} color={T.lemon} />
                 <span style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Direct-to-Meter</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>Reference {receipt.remoteSendRef || "System Auto"}. Credit applied automatically.</div>
           </div>
        )}

        <div style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: T.muted }}>
           <div style={{ marginBottom: 4 }}>This is an automated system generated receipt from Beverly CRM.</div>
           <div>Verified Digitally • {formatDateTime(new Date().toISOString())}</div>
        </div>
      </div>

      <div style={{ marginTop: 32, textAlign: "center" }}>
         <VwBtn variant="primary" size="lg" icon={Zap} onClick={() => window.location.href = "/vendor/buy"}>New Purchase</VwBtn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VENDOR TOP-UP VIEW — Fund Wallet Flow
   ═══════════════════════════════════════════════════════════════════════════ */

function VendorTopUpViewLegacy({
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
  onSubmit: () => Promise<void>;
}) {
  const [step] = useState<0 | 1>(0);
  return (
    <div className="status-fade-in" style={{ padding: "24px", maxWidth: 600 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 className="vw-page-title">Fund Wallet</h1>
        <p className="vw-page-sub">Top up your wallet balance via bank transfer</p>
      </div>

      <VwStepBar
        steps={["Initiate", "Upload Proof", "Under Review", "Confirmed", "Posted"]}
        current={step === 0 ? 0 : 1}
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
  onSubmit: () => Promise<void>;
}) {
  const [stage, setStage] = useState<"initiate" | "proof" | "posted">("initiate");
  const [copied, setCopied] = useState<string | null>(null);
  const numericAmount = Number(amount || "0");
  const fundingReference = `FND-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Math.max(numericAmount, 1)).padStart(6, "0").slice(-6)}`;
  const bankRows = [
    { label: "Bank Name", value: "First Bank of Nigeria" },
    { label: "Account Name", value: "Beverly Technology Ltd" },
    { label: "Account Number", value: "2034567891" },
    { label: "Reference", value: fundingReference },
  ];

  const copyValue = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const handleSubmit = async () => {
    await onSubmit();
    setStage("posted");
  };

  return (
    <div className="status-fade-in" style={{ padding: "24px", maxWidth: 860 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 className="vw-page-title">Fund Wallet</h1>
        <p className="vw-page-sub">Top up your wallet balance via bank transfer</p>
      </div>

      <VwStepBar
        steps={["Initiate", "Upload Proof", "Under Review", "Confirmed", "Posted"]}
        current={stage === "initiate" ? 0 : stage === "proof" ? 1 : 4}
      />

      <VwInfoBox type="lemon">
        <strong>Funding ≠ Token.</strong> This process increases your wallet balance only. Buy Units is the flow that issues tokens or remote sends.
      </VwInfoBox>

      {stage === "initiate" ? (
        <div className="vw-surface vw-surface--padded vw-fadeUp">
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div className="vw-field">
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

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["50000", "100000", "200000", "500000"].map((quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => setAmount(quick)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 999,
                      border: `1px solid ${amount === quick ? T.lemon : T.border}`,
                      background: amount === quick ? T.lemonLight : T.surface,
                      color: amount === quick ? T.lemonText : T.textMid,
                      fontFamily: T.font,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {NGN(Number(quick))}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {[
                { value: "bank_transfer", title: "Bank Transfer", desc: "Use your bank app or branch transfer. Upload proof in the next step." },
                { value: "cash_branch", title: "Cash Branch", desc: "Pay cash at branch and upload stamped teller or receipt as proof." },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setChannel(option.value as "bank_transfer" | "cash_branch")}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: `1px solid ${channel === option.value ? T.primary : T.border}`,
                    background: channel === option.value ? T.primaryLight : T.surface,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <CircleDot size={16} color={channel === option.value ? T.primary : T.faint} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{option.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <VwBtn variant="primary" onClick={() => setStage("proof")} disabled={!numericAmount || numericAmount <= 0}>
              Continue to Upload Proof
            </VwBtn>
          </div>
        </div>
      ) : null}

      {stage === "proof" ? (
        <div className="vw-surface vw-surface--padded vw-fadeUp" style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Funding Reference</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontFamily: T.mono }}>{fundingReference}</div>
              <div style={{ marginTop: 12 }}>
                <VwBtn variant="outline" size="sm" icon={Copy} onClick={() => void copyValue(fundingReference)}>
                  {copied === fundingReference ? "Copied" : "Copy Reference"}
                </VwBtn>
              </div>
            </div>

            <div style={{ background: T.lemonLight, border: `1px solid ${T.lemon}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.lemonText, marginBottom: 6 }}>Amount to transfer</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.text }}>{NGN(numericAmount || 0)}</div>
              <div style={{ fontSize: 12, color: T.textMid, marginTop: 8 }}>{formatFundingChannelLabel(channel)}</div>
            </div>
          </div>

          <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
            {bankRows.map((row) => (
              <div key={row.label} style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.muted }}>{row.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: row.label === "Reference" || row.label === "Account Number" ? T.mono : T.font }}>{row.value}</div>
                <button type="button" onClick={() => void copyValue(row.value)} style={{ border: `1px solid ${T.border}`, background: T.surface, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: T.textMid, cursor: "pointer" }}>
                  {copied === row.value ? "Copied" : "Copy"}
                </button>
              </div>
            ))}
          </div>

          <div className="vw-field">
            <label className="vw-field__label">Upload Funding Proof *</label>
            <div className="vw-upload-zone" onClick={() => document.getElementById("proof-upload")?.click()} style={{ minHeight: 144, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div>
                <Upload size={18} color={T.primary} style={{ marginBottom: 8 }} />
                <div className="vw-upload-zone__text">
                  {proofFile ? `Attachment: ${proofFile.name}` : "Drop file here or click to upload"}
                </div>
                <div className="vw-upload-zone__hint">PDF, JPG, PNG · Max 5 MB</div>
              </div>
            </div>
            <input
              id="proof-upload"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <VwBtn variant="outline" onClick={() => setStage("initiate")}>Back</VwBtn>
            <VwBtn variant="primary" onClick={() => void handleSubmit()} disabled={loading || !numericAmount || !proofFile}>
              {loading ? "Submitting..." : "Submit Funding Request"}
            </VwBtn>
          </div>
        </div>
      ) : null}

      {stage === "posted" ? (
        <div className="vw-surface vw-surface--padded vw-fadeUp" style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: T.successBg, display: "grid", placeItems: "center" }}>
              <CheckCircle2 size={22} color={T.success} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>Funding request submitted</div>
              <div style={{ fontSize: 12, color: T.muted }}>Reference {fundingReference} is now in the finance review queue.</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { title: "Under Review", copy: "Proof received and queued for finance validation.", tone: T.warningBg, color: T.warning },
              { title: "Confirmed", copy: "Bank movement will be matched to your reference.", tone: T.infoBg, color: T.info },
              { title: "Posted", copy: "Approved funds will appear in your wallet balance.", tone: T.successBg, color: T.success },
            ].map((item) => (
              <div key={item.title} style={{ background: item.tone, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.6 }}>{item.copy}</div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
            {[
              ["Funding Amount", NGN(numericAmount || 0)],
              ["Channel", formatFundingChannelLabel(channel)],
              ["Proof File", proofFile?.name ?? "Uploaded"],
              ["Expected Posting", "After finance confirmation"],
            ].map(([label, value], index) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: index % 2 === 0 ? T.surface : T.surface2 }}>
                <div style={{ fontSize: 12, color: T.muted }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <VwBtn variant="outline" onClick={() => setStage("initiate")}>Create Another Request</VwBtn>
            <VwBtn variant="primary" onClick={() => window.location.assign("/vendor/transactions")}>View Transactions</VwBtn>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
    <div className="status-fade-in" style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <h1 className="vw-page-title">Vendor Access Form</h1>
        <p className="vw-page-sub">Establish your identity and financial settlement parameters</p>
      </div>

      <VwStepBar
        steps={["Registration", "Internal Review", "Ready"]}
        current={vendorStatus === "active" ? 3 : vendorStatus === "pending_review" ? 1 : 0}
      />

      {feedback && (
        <VwInfoBox type={feedback.toLowerCase().includes("fail") ? "danger" : "success"} icon={feedback.toLowerCase().includes("fail") ? AlertCircle : ShieldCheck}>
          {feedback}
        </VwInfoBox>
      )}

      {vendorStatus === "pending_review" && (
        <VwInfoBox type="info" icon={Clock}>
          <strong>Queue Position Locked.</strong> Our finance team is reviewing your documentation. Corrections will be requested if needed.
        </VwInfoBox>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 32 }}>
        
        {/* Business Section */}
        <VwSurface title="Legal & Identity" icon={ShieldCheck} padded>
           <div style={{ display: "grid", gap: 20 }}>
             {[
               { label: "Business Legal Name", key: "legalName" as const },
               { label: "Public Display Name", key: "displayName" as const },
               { label: "Registration No (CAC)", key: "registrationNumber" as const },
               { label: "Tax ID / TIN", key: "taxId" as const },
             ].map((field) => (
               <div className="vw-field" key={field.key}>
                 <label className="vw-field__label">{field.label}</label>
                 <input
                   value={form[field.key]}
                   onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                   className="vw-input"
                 />
               </div>
             ))}
           </div>
        </VwSurface>

        {/* Contact Section */}
        <VwSurface title="Communications" icon={User} padded>
           <div style={{ display: "grid", gap: 20 }}>
             {[
               { label: "Primary Contact Person", key: "contactName" as const },
               { label: "Direct Email Address", key: "contactEmail" as const },
               { label: "Phone Number", key: "contactPhone" as const },
               { label: "Secondary Contact", key: "alternateContactName" as const },
             ].map((field) => (
               <div className="vw-field" key={field.key}>
                 <label className="vw-field__label">{field.label}</label>
                 <input
                   value={form[field.key]}
                   onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                   className="vw-input"
                 />
               </div>
             ))}
           </div>
        </VwSurface>

        {/* Bank Section */}
        <VwSurface title="Settlement Node" icon={Wallet} padded>
           <div style={{ display: "grid", gap: 20 }}>
             {[
               { label: "Bank Institution", key: "bankName" as const },
               { label: "Account Holder", key: "bankAccountName" as const },
               { label: "Account Number", key: "bankAccountNumber" as const },
               { label: "Bank Sort Code", key: "bankSortCode" as const },
             ].map((field) => (
               <div className="vw-field" key={field.key}>
                 <label className="vw-field__label">{field.label}</label>
                 <input
                   value={form[field.key]}
                   onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                   className="vw-input"
                 />
               </div>
             ))}
           </div>
        </VwSurface>

        {/* Support Section */}
        <VwSurface title="Submission Assets" icon={FileText} padded>
           <div className="vw-field">
             <label className="vw-field__label">Business Address</label>
             <textarea
               rows={4}
               value={form.businessAddress}
               onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
               className="vw-input"
             />
           </div>
           <div className="vw-field" style={{ marginTop: 24 }}>
             <label className="vw-field__label">Submission Notes (Optional)</label>
             <textarea
               rows={4}
               value={form.onboardingNotes}
               onChange={(e) => setForm({ ...form, onboardingNotes: e.target.value })}
               className="vw-input"
               placeholder="Any specific instructions for treasury?"
             />
           </div>
        </VwSurface>
      </div>

      <div style={{ marginTop: 40, background: T.glass, border: `1px solid ${T.border}`, borderRadius: 20, padding: 32, textAlign: "center" }}>
         <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 24, color: T.muted }}>
            <ShieldCheck size={20} color={T.primary} />
            <span style={{ fontSize: 13 }}>By submitting, you agree to the Beverly Vendor Terms of Service.</span>
         </div>
         <VwBtn variant="primary" size="lg" icon={ArrowRight} onClick={onSubmit} disabled={submitting} full>
           {submitting ? "Transmitting Profile..." : "Submit Profile for Review"}
         </VwBtn>
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
          businessName={reviewVendor.businessName || reviewVendor.vendorCode}
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
          businessName={reviewVendor.businessName || reviewVendor.vendorCode}
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
  const [, setFundingRequest] = useState<VendorFundingRequestRecord | null>(null);
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
  const [statementRange] = useState(buildTodayStatementWindow());
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
        if (!cancelled) setDashboard(result);
        return;
      }
      if (page.vendorView === "transactions") {
        const result = await vendorWalletService.loadTransactions();
        if (!cancelled) setTransactions(result);
        return;
      }
      if (page.vendorView === "commission") {
        const result = await vendorWalletService.loadCommissionSummary();
        if (!cancelled) setCommissionSummary(result);
        return;
      }
      if (page.vendorView === "receipts") {
        const result = await vendorWalletService.loadReceipts();
        if (!cancelled) setReceipts(result);
        return;
      }
      if (page.vendorView === "statement") {
        const result = await vendorWalletService.loadStatement(statementRange);
        if (!cancelled) setStatement(result);
        return;
      }
      if (page.vendorView === "profile") {
        const result = await vendorWalletService.loadProfile();
        if (!cancelled) setProfile(result);
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
        if (!cancelled) setFundingRequest(result);
      }
    }

    void hydrate();
    return () => { cancelled = true; };
  }, [page.vendorView, params.receiptId, params.requestId, statementRange]);

  const availableBalance = dashboard?.wallet?.availableBalance ?? profile?.wallet?.availableBalance ?? 0;
  
  const filteredTransactions = useMemo(() => {
    const rows = transactions?.rows ?? [];
    if (transactionFilter === "all") return rows;
    if (transactionFilter === "debits") return rows.filter(r => r.direction === "debit");
    if (transactionFilter === "credits") return rows.filter(r => r.direction === "credit");
    return rows.filter(r => r.status.toLowerCase().includes(transactionFilter));
  }, [transactions, transactionFilter]);

  useEffect(() => {
    if (profile) setOnboardingForm(createOnboardingFormState(profile));
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
    if (!purchaseDraft.selectedMeter) return;
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
    if (!draft) return;
    setSubmitting(true);
    try {
      const payload = { idempotencyKey: draft.idempotencyKey || createVendorIdempotencyKey(), walletId: draft.walletId, meterSn: draft.meterSn, customerRef: draft.customerRef, amount: draft.amount, siteCode: draft.siteCode };
      const result = draft.deliveryMethod === "remote_send" ? await vendorWalletService.purchaseRemoteSend(payload) : await vendorWalletService.purchaseGenerateToken(payload);
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
        await vendorWalletService.submitFundingProof(created.id, { fileName: proofFile.name, documentId: upload.documentId, mimeType: proofFile.type, fileSize: proofFile.size });
      }
      navigate(`/vendor/topup/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitOnboarding() {
    if (!profile?.vendor.vendorCode) return;
    setSubmitting(true);
    setProfileFeedback(null);
    try {
      const payload: VendorOnboardingPayload = {
        vendorId: profile.vendor.id ?? "",
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
      setProfileFeedback("Access form submitted for finance review.");
    } catch (error) {
      setProfileFeedback(error instanceof Error ? error.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Admin view: route vendor management pages to admin-specific UI ──
  if (!isVendorWorkspaceUser(authUser)) {
    return <AdminVendorQueueView />;
  }

  const onboardingRequired = !profile?.wallet || profile?.vendor.status !== "active";

  return (
    <div className="vendor-wallet-portal-shell status-fade-in">
       {/* Sidebar / Navigation */}
       <div className="vw-portal-aside">
          <div className="vw-portal-brand">
             <div className="vw-portal-logo"><Zap size={20} fill="currentColor" /></div>
             <div className="vw-portal-name">Beverly Wallet</div>
          </div>

          <nav className="vw-portal-nav">
             {[
               { id: "dashboard", label: "Dashboard", icon: Activity, path: "/vendor" },
               { id: "buy", label: "Buy Units", icon: Zap, path: "/vendor/buy" },
               { id: "topup", label: "Funding", icon: Wallet, path: "/vendor/topup" },
               { id: "receipts", label: "Receipts", icon: Receipt, path: "/vendor/receipts" },
               { id: "transactions", label: "Ledger", icon: Clock, path: "/vendor/transactions" },
               { id: "commission", label: "Earnings", icon: TrendingUp, path: "/vendor/commission" },
               { id: "statement", label: "Statement", icon: FileText, path: "/vendor/statement" },
               { id: "profile", label: "Account", icon: User, path: "/vendor/profile" },
             ].map((item) => {
               const isActive = page.vendorView === item.id || (item.id === "buy" && page.vendorView.startsWith("buy"));
               return (
                 <Link key={item.id} to={item.path} className={`vw-portal-nav-item ${isActive ? "active" : ""}`}>
                    <item.icon size={18} />
                    <span>{item.label}</span>
                 </Link>
               );
             })}
          </nav>

          <div className="vw-portal-footer">
             <VwBtn variant="ghost" size="sm" icon={LogOut} onClick={() => window.location.href = "/logout"}>Exit Portal</VwBtn>
          </div>
       </div>

       {/* Main Content Area */}
       <div className="vw-portal-main">
          {/* Top Header */}
          <header className="vw-portal-header">
             <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, background: T.glass, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}` }}>
                   <Activity size={18} color={T.primary} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{profile?.vendor.businessName || "Vendor Terminal"}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{profile?.vendor.siteName || "Global Node"}</div>
                </div>
             </div>
             
             <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ textAlign: "right", paddingRight: 16, borderRight: `1px solid ${T.border}` }}>
                   <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>Floating Cap</div>
                   <div style={{ fontSize: 14, fontWeight: 800, color: T.primary }}>{NGN(availableBalance)}</div>
                </div>
                <VwBtn variant="ghost" size="sm" icon={Settings}>Settings</VwBtn>
             </div>
          </header>

          <main className="vw-portal-content-scroll">
            {page.vendorView === "dashboard" && <VendorDashboardView dashboard={dashboard} />}
            
            {page.vendorView === "buy" && (
              <VendorBuyView draft={purchaseDraft} onSearch={handleSearchMeters} onDraftChange={setPurchaseDraft} onContinue={handleContinuePurchase} searching={searchingMeters} results={searchResults} availableBalance={availableBalance} />
            )}

            {page.vendorView === "buy-confirm" && (
               <div className="status-fade-in" style={{ padding: "24px", maxWidth: 660 }}>
                  <VwSurface title="Confirm Purchase" icon={ShieldCheck} padded>
                     <VwConfirmTable
                        rows={[
                          { key: "Customer", value: purchaseDraft.selectedMeter?.customerName || "--" },
                          { key: "Meter SN", value: purchaseDraft.selectedMeter?.meterSn || "--", mono: true },
                          { key: "Delivery", value: purchaseDraft.deliveryMethod === "remote_send" ? "Remote Send to Meter" : "Generate Token (20-digit code)" },
                          { key: "Vending Sum", value: NGN(Number(purchaseDraft.amount)), primary: true },
                          { key: "Available Balance", value: NGN(availableBalance) },
                          { key: "Wallet balance after", value: NGN(Math.max(availableBalance - Number(purchaseDraft.amount), 0)) },
                        ]}
                      />
                      <VwInfoBox type="warning" icon={AlertCircle}>This debits <strong>{NGN(Number(purchaseDraft.amount))}</strong> immediately. The {purchaseDraft.deliveryMethod === "remote_send" ? "remote-send reference" : "token"} is issued only after successful processing.</VwInfoBox>
                      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                        <VwBtn variant="ghost" size="lg" onClick={() => navigate("/vendor/buy")}>Back</VwBtn>
                        <VwBtn variant="lemon" size="lg" full onClick={() => void handleSubmitPurchase()} loading={submitting}>Authorize Debit</VwBtn>
                      </div>
                  </VwSurface>
               </div>
            )}

            {page.vendorView === "buy-receipt" && <VendorReceiptView detail={receiptDetail ?? vendorWalletService.readCachedReceiptDetail()} />}
            
            {page.vendorView === "commission" && (
               <div style={{ padding: 32 }}>
                  <VwSurface title="Earnings Summary" icon={TrendingUp} padded>
                     <div className="vw-grid-3">
                        <VwKPI label="Outstanding" value={NGN(commissionSummary?.totalOutstanding ?? 0)} icon={TrendingUp} />
                        <VwKPI label="Accrued" value={NGN(commissionSummary?.totalAccrued ?? 0)} icon={Activity} />
                        <VwKPI label="Rate" value={`${((commissionSummary?.rule.rate ?? 0) * 100).toFixed(2)}%`} icon={ShieldCheck} />
                     </div>
                     <div style={{ marginTop: 32 }}>
                        <DataTable title="Ledger" description="Recent commission movements" headers={["Date", "Ref", "Amount", "Rate"]} rows={(commissionSummary?.history.rows ?? []).map(r => [formatDateTime(r.createdAt), r.reference, NGN(r.amount), r.rate !== null ? `${(r.rate * 100).toFixed(2)}%` : "-"])} />
                     </div>
                  </VwSurface>
               </div>
            )}

            {page.vendorView === "transactions" && (
               <div style={{ padding: 24 }}>
                  <VwSurface title="Wallet Ledger" icon={Clock} padded>
                     <div className="vw-filter-pills" style={{ marginBottom: 24 }}>
                        {["all", "debits", "credits", "successful", "failed"].map(f => (
                           <button key={f} className={`vw-filter-pill ${transactionFilter === f ? "vw-filter-pill--active" : ""}`} onClick={() => setTransactionFilter(f as any)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
                        ))}
                     </div>
                     <div className="vw-table-wrap">
                        <table className="vw-table">
                          <thead><tr><th>Date / Time</th><th>Reference</th><th>Description</th><th>Method</th><th>Debit (₦)</th><th>Credit (₦)</th><th>Balance After</th><th>Status</th><th>Receipt</th></tr></thead>
                          <tbody>
                            {filteredTransactions.map(t => (
                              <tr key={t.id}>
                                <td style={{ color: T.muted, fontSize: 12 }}>{formatDateTime(t.createdAt)}</td>
                                <td style={{ fontFamily: T.mono, fontSize: 12, color: T.primary }}>{t.reference || "--"}</td>
                                <td style={{ fontWeight: 600 }}>{t.description}</td>
                                <td>{t.deliveryMethod ? <VwBadge variant={t.deliveryMethod === "remote_send" ? "info" : "success"}>{t.deliveryMethod === "remote_send" ? "Remote Send" : "Token"}</VwBadge> : <VwBadge variant="lemon">Funding</VwBadge>}</td>
                                <td style={{ fontWeight: 700, color: t.direction === "debit" ? T.danger : T.muted }}>{t.direction === "debit" ? NGN(t.amount) : "—"}</td>
                                <td style={{ fontWeight: 700, color: t.direction === "credit" ? T.primary : T.muted }}>{t.direction === "credit" ? NGN(t.amount) : "—"}</td>
                                <td style={{ fontWeight: 700, fontFamily: T.mono }}>{t.balanceAfter === null ? "—" : NGN(t.balanceAfter)}</td>
                                <td><VwBadge variant={getStatusTone(t.status)} dot>{t.status}</VwBadge></td>
                                <td>{t.receiptId ? <Link to={`/vendor/buy/receipt/${t.receiptId}`}><VwBtn variant="ghost" size="xs">View</VwBtn></Link> : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                     </div>
                  </VwSurface>
               </div>
            )}

            {page.vendorView === "receipts" && (
               <div style={{ padding: 24 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}>
                    {(receipts?.rows ?? []).map(r => (
                      <Link key={r.id} to={`/vendor/buy/receipt/${r.id}`} className="vw-quick-card" style={{ textDecoration: "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                          <div>
                            <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{r.receiptNumber}</div>
                            <div className="vw-quick-card__title" style={{ marginTop: 4 }}>{r.customerRef || "Purchase Receipt"}</div>
                          </div>
                          <VwBadge variant={r.deliveryMethod === "remote_send" ? "info" : "success"}>{r.deliveryMethod === "remote_send" ? "Remote" : "Token"}</VwBadge>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: 16 }}>
                          <span style={{ fontSize: 12, color: T.muted }}>{formatDateTime(r.issuedAt).split(",")[0]}</span>
                          <span style={{ fontWeight: 800, color: T.text, fontSize: 18 }}>{NGN(r.amount)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
               </div>
            )}

            {page.vendorView === "topup" && (
               <VendorTopUpView loading={submitting} amount={topUpAmount} channel={topUpChannel} proofFile={proofFile} setAmount={setTopUpAmount} setChannel={setTopUpChannel} setProofFile={setProofFile} onSubmit={handleSubmitFundingRequest} />
            )}

            {page.vendorView === "statement" && (
              <div style={{ padding: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, alignItems: "start" }}>
                  <VwSurface title="Generate Statement" icon={FileText} padded>
                    <div className="vw-field" style={{ marginBottom: 14 }}>
                      <label className="vw-field__label">From Date</label>
                      <input type="date" value={statementRange.fromDate} readOnly className="vw-input" />
                    </div>
                    <div className="vw-field" style={{ marginBottom: 14 }}>
                      <label className="vw-field__label">To Date</label>
                      <input type="date" value={statementRange.toDate} readOnly className="vw-input" />
                    </div>
                    <div className="vw-field" style={{ marginBottom: 14 }}>
                      <label className="vw-field__label">Format</label>
                      <select className="vw-input" defaultValue="CSV">
                        <option>CSV</option>
                        <option>PDF</option>
                        <option>Excel (.xlsx)</option>
                      </select>
                    </div>
                    <VwBtn full icon={Download}>Generate & Download</VwBtn>
                  </VwSurface>

                  <VwSurface title="Statement Preview" icon={Activity} padded>
                    <div className="vw-table-wrap">
                      <table className="vw-table">
                        <thead><tr><th>Date / Time</th><th>Reference</th><th>Description</th><th>Debit (₦)</th><th>Credit (₦)</th><th>Balance After</th></tr></thead>
                        <tbody>
                          {(statement?.rows ?? []).map((row) => (
                            <tr key={row.id}>
                              <td style={{ color: T.muted, fontSize: 12 }}>{formatDateTime(row.createdAt)}</td>
                              <td style={{ fontFamily: T.mono, color: T.primary }}>{row.reference}</td>
                              <td>{row.description}</td>
                              <td style={{ color: row.debit > 0 ? T.danger : T.muted, fontWeight: 700 }}>{row.debit > 0 ? NGN(row.debit) : "—"}</td>
                              <td style={{ color: row.credit > 0 ? T.primary : T.muted, fontWeight: 700 }}>{row.credit > 0 ? NGN(row.credit) : "—"}</td>
                              <td style={{ fontFamily: T.mono, fontWeight: 700 }}>{NGN(row.balanceAfter)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </VwSurface>
                </div>
              </div>
            )}

            {page.vendorView === "profile" && (
              <div style={{ padding: 24 }}>
                 {onboardingRequired ? (
                   <VendorOnboardingView profile={profile} form={onboardingForm} setForm={setOnboardingForm} submitting={submitting} feedback={profileFeedback} onSubmit={() => void handleSubmitOnboarding()} />
                 ) : (
                   <div className="status-fade-in">
                      <div style={{ display: "grid", gap: 20 }}>
                        <VwSurface title="Account Information" icon={User} padded>
                          <VwConfirmTable rows={[
                            { key: "Business Name", value: profile?.vendor.businessName || "--" },
                            { key: "Vendor Code", value: profile?.vendor.vendorCode || "--", mono: true },
                            { key: "Site", value: profile?.vendor.siteName || "--" },
                            { key: "Wallet Number", value: profile?.wallet?.walletNumber || "--", mono: true },
                            { key: "Wallet Status", value: profile?.wallet?.status || "--" },
                          ]} />
                        </VwSurface>
                        <VwSurface title="Contact Details" icon={User} padded>
                          <VwConfirmTable rows={[
                            { key: "Primary Contact", value: profile?.vendor.contactName || "--" },
                            { key: "Email", value: profile?.vendor.contactEmail || "--" },
                            { key: "Phone", value: profile?.vendor.contactPhone || "--" },
                            { key: "Secondary Contact", value: profile?.vendor.alternateContactName || "--" },
                          ]} />
                        </VwSurface>
                        <VwSurface title="KYC Status" icon={ShieldCheck} padded>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
                            <VwKPI label="Compliance" value={profile?.vendor.kycStatus || "Review"} icon={ShieldCheck} />
                            <VwKPI label="Documents" value={String(profile?.vendor.kycDocumentCount ?? 0)} icon={FileText} />
                            <VwKPI label="Reserved Balance" value={NGN(profile?.wallet?.reservedBalance ?? 0)} icon={Wallet} />
                          </div>
                          <VwConfirmTable rows={[
                            { key: "Registration Number", value: profile?.vendor.registrationNumber || "--" },
                            { key: "Tax ID", value: profile?.vendor.taxId || "--" },
                            { key: "Bank", value: profile?.vendor.bankName || "--" },
                            { key: "Account Name", value: profile?.vendor.accountName || "--" },
                          ]} />
                        </VwSurface>
                      </div>
                   </div>
                 )}
              </div>
            )}
          </main>
       </div>
    </div>
  );
}

export default VendorPage;
