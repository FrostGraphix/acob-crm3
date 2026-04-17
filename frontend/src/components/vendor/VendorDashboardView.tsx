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
  VendorEmptyState,
  VendorLoadingPanel,
  VendorTable,
  type VendorTableColumn,
} from "./VendorPortalPrimitives.tsx";
import { formatDateTime, getStatusTone } from "./VendorPortalShared.tsx";

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
    return <VendorLoadingPanel label="Loading vendor wallet dashboard..." />;
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
    { key: "time", label: "Date / Time", render: (row) => formatDateTime(row.createdAt) },
    {
      key: "type",
      label: "Type",
      render: (row) => <VwBadge variant={getStatusTone(row.type)}>{row.type}</VwBadge>,
    },
    { key: "description", label: "Description", render: (row) => row.description },
    {
      key: "amount",
      label: "Amount",
      render: (row) => (
        <span style={{ color: row.direction === "debit" ? "var(--vw-danger)" : "var(--vw-success)", fontWeight: 700 }}>
          {row.direction === "debit" ? "-" : "+"}
          {NGN(row.amount)}
        </span>
      ),
    },
    {
      key: "balance",
      label: "Balance After",
      render: (row) => (row.balanceAfter === null ? "--" : NGN(row.balanceAfter)),
    },
  ];

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      {/* Hero */}
      <div className="vw-hero">
        <div className="vw-hero__top">
          <div>
            <div className="vw-hero__eyebrow">Available Balance</div>
            <div className="vw-hero__balance">
              {dashboard.wallet ? NGN(dashboard.wallet.availableBalance) : "₦0.00"}
            </div>
            <div className="vw-hero__sub">{vendorName}</div>
          </div>
          <div className="vw-hero__right">
            <VwBadge variant={getStatusTone(walletStatus)} dot lg>{walletStatus}</VwBadge>
            <VwBtn variant="lemon" size="sm" onClick={() => navigate("/vendor/buy")}>Buy Units</VwBtn>
          </div>
        </div>
      </div>

      {statusReason ? (
        <VwInfoBox type="danger">
          <strong>Wallet action required.</strong> {statusReason}
        </VwInfoBox>
      ) : null}

      {state.error ? <VwInfoBox type="danger">{state.error}</VwInfoBox> : null}

      {/* KPIs */}
      <div className="vw-grid-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <VwKPI
          label="Available Balance"
          value={NGN(dashboard.wallet?.availableBalance ?? 0)}
          sub="Live wallet snapshot"
          iconBg="#e6f4e6"
        />
        <VwKPI
          label="Today's Purchases"
          value={NGN(dashboard.todayPurchaseAmount ?? 0)}
          sub={`${dashboard.todayPurchaseCount ?? 0} successful debits`}
          iconBg="#EFF6FF"
        />
        <VwKPI
          label="Pending Reserved"
          value={NGN(dashboard.wallet?.reservedBalance ?? 0)}
          sub="Funds tied to in-flight orders"
          iconBg="#FFFBEB"
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <VwBtn variant="primary" onClick={() => navigate("/vendor/buy")}>Buy Units</VwBtn>
        <VwBtn variant="outline" onClick={() => navigate("/vendor/topup")}>Request Top-Up</VwBtn>
      </div>

      {/* Recent Transactions */}
      <div className="vw-surface">
        <div className="vw-surface__header">
          <span className="vw-surface__title">Recent Transactions</span>
          <VwBtn variant="ghost" size="xs" onClick={() => navigate("/vendor/receipts")}>
            Open Archive
          </VwBtn>
        </div>
        <div style={{ padding: "0 20px 14px" }}>
          <VendorTable
            columns={columns}
            emptyDescription="Transactions will appear here once the wallet starts moving."
            emptyTitle="No recent transactions"
            rows={(dashboard.recentTransactions ?? []).slice(0, 10)}
          />
        </div>
      </div>

      {/* Recent Receipts */}
      <div className="vw-surface">
        <div className="vw-surface__header">
          <span className="vw-surface__title">Latest Receipts</span>
          <VwBtn variant="ghost" size="xs" onClick={() => navigate("/vendor/receipts")}>
            Open Archive
          </VwBtn>
        </div>
        <div style={{ padding: "14px 20px" }}>
          {(dashboard.recentReceipts ?? []).length === 0 ? (
            <VendorEmptyState
              title="No receipts yet"
              description="Receipts are generated after successful remote-send and token vending actions."
            />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {(dashboard.recentReceipts ?? []).slice(0, 5).map((receipt) => (
                <div
                  key={receipt.id}
                  onClick={() => navigate(`/vendor/buy/receipt/${receipt.id}`)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--vw-border)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--vw-text)" }}>{receipt.receiptNumber}</div>
                    <div style={{ fontSize: 11, color: "var(--vw-faint)" }}>{receipt.meterSn}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{NGN(receipt.amount)}</span>
                    <VwBadge variant={getStatusTone(receipt.deliveryMethod)}>{receipt.deliveryMethod}</VwBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
