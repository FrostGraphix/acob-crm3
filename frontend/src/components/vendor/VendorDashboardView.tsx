import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { vendorWalletService } from "../../services/vendor-wallet.ts";
import type { VendorDashboardResponse, VendorTransactionRecord } from "../../types/vendor-wallet.ts";
import {
  NGN,
  VwBadge,
  VwBtn,
  VwKPI,
  VwInfoBox,
  VwSurface,
  VendorLoadingPanel,
  VendorTable,
  type VendorTableColumn,
  T,
} from "./VendorPortalPrimitives.tsx";
import { formatDateTime, getStatusTone } from "./VendorPortalUtils";
import { 
  Zap, Activity, Wallet,
  Clock, TrendingUp, ShieldCheck,
  Plus, ReceiptText
} from "lucide-react";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

function createAsyncState<T>(): AsyncState<T> {
  return {
    data: null,
    error: null,
    loading: true,
  };
}

function buildFallbackDashboard(displayName: string, siteCode: string | null) {
  return {
    wallet: null,
    vendor: {
      businessName: displayName,
      displayName,
      legalName: displayName,
      lastLoginAt: null,
      siteCode,
      status: "pending_review",
      vendorCode: undefined,
      statusReason: null,
    },
    todayPurchaseAmount: 0,
    todayPurchaseCount: 0,
    recentTransactions: [],
    recentReceipts: [],
  } satisfies VendorDashboardResponse;
}

export function VendorDashboardView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<AsyncState<VendorDashboardResponse>>(createAsyncState());

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const data = await vendorWalletService.loadDashboard();
        if (!cancelled) {
          setState({ data, error: null, loading: false });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : "Unable to load the vendor dashboard.",
            loading: false,
          });
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", padding: 40 }}>
        <VendorLoadingPanel label="Initializing premium wallet environment..." />
      </div>
    );
  }

  const dashboard = state.data ?? buildFallbackDashboard(user?.displayName ?? "Vendor Account", user?.siteCode ?? null);
  const vendorName = dashboard.vendor?.displayName ?? dashboard.vendor?.legalName ?? user?.displayName ?? "Vendor Account";
  const walletStatus = dashboard.wallet?.status ?? "pending";
  const vendorStatus = dashboard.vendor?.status ?? "pending_review";
  const statusReason =
    dashboard.vendor?.statusReason ??
    (walletStatus !== "active"
      ? "Wallet operations remain restricted until finance activates the wallet."
      : vendorStatus !== "active"
        ? "Your vendor account is not yet active for live purchases."
        : null);

  const columns: VendorTableColumn<VendorTransactionRecord>[] = [
    { 
      key: "time", 
      label: "Date / Time", 
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={12} style={{ color: T.muted }} />
          <span style={{ fontSize: 13 }}>{formatDateTime(row.createdAt)}</span>
        </div>
      )
    },
    {
      key: "type",
      label: "Type",
      render: (row) => <VwBadge variant={getStatusTone(row.type)} dot>{row.type}</VwBadge>,
    },
    { 
      key: "description", 
      label: "Description", 
      render: (row) => (
        <span style={{ color: T.text, fontWeight: 500 }}>{row.description}</span>
      ) 
    },
    {
      key: "amount",
      label: "Amount",
      render: (row) => (
        <span style={{ color: row.direction === "debit" ? T.danger : T.primary, fontWeight: 800, fontFamily: T.mono }}>
          {row.direction === "debit" ? "-" : "+"}
          {NGN(row.amount)}
        </span>
      ),
    },
    {
      key: "balance",
      label: "Balance After",
      render: (row) => (
        <span style={{ fontFamily: T.mono, color: T.muted }}>
          {row.balanceAfter === null ? "--" : NGN(row.balanceAfter)}
        </span>
      ),
    },
  ];

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
        <div>
          <h1 className="vw-page-title">Wallet Portal</h1>
          <p className="vw-page-sub">Powering your energy vending operations</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>Session Status</div>
          <VwBadge variant={getStatusTone(walletStatus)} dot lg>{walletStatus}</VwBadge>
        </div>
      </div>

      {/* Hero */}
      <div className="vw-hero">
        <div className="vw-hero__top">
          <div>
            <div className="vw-hero__eyebrow">Liquid Capital Holdings</div>
            <div className="vw-hero__balance">
              {dashboard.wallet ? NGN(dashboard.wallet.availableBalance) : "₦0.00"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <VwBadge variant="lemon" lg>
                <ShieldCheck size={14} style={{ marginRight: 6 }} />
                Secure Wallet
              </VwBadge>
              <div className="vw-hero__sub">{vendorName} • {dashboard.vendor?.vendorCode || "VND-NEW"}</div>
            </div>
          </div>
          <div className="vw-hero__right">
             <div style={{ display: "flex", gap: 12 }}>
               <VwBtn variant="lemon" size="md" icon={Zap} onClick={() => navigate("/vendor/buy")}>Buy Units</VwBtn>
               <VwBtn variant="ghost" size="md" icon={Plus} onClick={() => navigate("/vendor/topup")}>Funding</VwBtn>
             </div>
          </div>
        </div>
      </div>

      {statusReason ? (
        <VwInfoBox type="danger" icon={Zap}>
          <strong>Action Required:</strong> {statusReason}
        </VwInfoBox>
      ) : null}

      {state.error ? <VwInfoBox type="danger">{state.error}</VwInfoBox> : null}

      {/* KPIs */}
      <div className="vw-grid-3">
        <VwKPI
          label="Total Liquidity"
          value={NGN(dashboard.wallet?.availableBalance ?? 0)}
          sub="Available for instant vending"
          icon={Wallet}
          trend="+12.5%"
        />
        <VwKPI
          label="Today's Performance"
          value={NGN(dashboard.todayPurchaseAmount ?? 0)}
          sub={`${dashboard.todayPurchaseCount ?? 0} successful cycles`}
          icon={TrendingUp}
        />
        <VwKPI
          label="Reserved Capital"
          value={NGN(dashboard.wallet?.reservedBalance ?? 0)}
          sub="Committed to pending flow"
          icon={Activity}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
        {/* Recent Transactions */}
        <VwSurface 
          title="Streaming Ledger" 
          icon={Activity}
          action={
            <VwBtn variant="ghost" size="xs" onClick={() => navigate("/vendor/receipts")}>
              View Ledger
            </VwBtn>
          }
        >
          <div style={{ padding: "0 4px 14px" }}>
            <VendorTable
              columns={columns}
              emptyDescription="No vending flows detected in the current epoch."
              emptyTitle="Ledger is Quiet"
              rows={(dashboard.recentTransactions ?? []).slice(0, 10)}
            />
          </div>
        </VwSurface>

        {/* Latest Receipts */}
        <VwSurface 
          title="Vending Proofs" 
          icon={ReceiptText}
          action={
            <VwBtn variant="ghost" size="xs" onClick={() => navigate("/vendor/receipts")}>
              See All
            </VwBtn>
          }
        >
          <div style={{ padding: "14px 20px" }}>
            {(dashboard.recentReceipts ?? []).length === 0 ? (
              <div style={{ padding: "20px 0" }}>
                <VwInfoBox type="info">No recent vending proofs generated.</VwInfoBox>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {(dashboard.recentReceipts ?? []).slice(0, 5).map((receipt) => (
                  <div
                    key={receipt.id}
                    onClick={() => navigate(`/vendor/buy/receipt/${receipt.id}`)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px",
                      borderRadius: 16,
                      background: T.glass,
                      border: `1px solid ${T.border}`,
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = T.primary;
                      e.currentTarget.style.background = "rgba(0, 200, 83, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.background = T.glass;
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>{receipt.receiptNumber}</div>
                      <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, marginTop: 4 }}>{receipt.meterSn}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: T.primary, fontFamily: T.mono }}>{NGN(receipt.amount)}</div>
                      <div style={{ marginTop: 4 }}>
                        <VwBadge variant={getStatusTone(receipt.deliveryMethod)} lg>{receipt.deliveryMethod}</VwBadge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </VwSurface>
      </div>
    </div>
  );
}
