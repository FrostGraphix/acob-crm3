import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BEVERLY_RECEIPT_BRAND } from "../../services/receipt-branding.ts";
import { createVendorIdempotencyKey, vendorWalletService } from "../../services/vendor-wallet.ts";
import type {
  VendorDashboardResponse,
  VendorMeterSearchResult,
  VendorPurchaseDraft,
  VendorReceiptDetailResponse,
} from "../../types/vendor-wallet.ts";
import type { WalletPurchaseDeliveryMethod } from "../../../../common/types";
import {
  NGN,
  VwBadge,
  VwBtn,
  VwInfoBox,
  VwStepBar,
  VwConfirmTable,
  VendorEmptyState,
  VendorKeyValueGrid,
  VendorLoadingPanel,
} from "./VendorPortalPrimitives.tsx";
import { formatDateOnly, formatDateTime, formatTokenValue, getStatusTone } from "./VendorPortalUtils";
import { StatusMessage } from "./VendorPortalShared";

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

export function VendorBuyView() {
  const navigate = useNavigate();
  const [dashboardState, setDashboardState] = useState<AsyncState<VendorDashboardResponse>>(createAsyncState());
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<VendorMeterSearchResult[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<VendorMeterSearchResult | null>(null);
  const [amount, setAmount] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<WalletPurchaseDeliveryMethod>("remote_send");
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateDashboard() {
      try {
        const data = await vendorWalletService.loadDashboard();
        if (!cancelled) {
          setDashboardState({ data, error: null, loading: false });
        }
      } catch (error) {
        if (!cancelled) {
          setDashboardState({
            data: null,
            error: error instanceof Error ? error.message : "Unable to load wallet availability.",
            loading: false,
          });
        }
      }
    }

    void hydrateDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const dashboard = dashboardState.data;
  const vendorStatus = dashboard?.vendor.status ?? "pending_review";
  const walletStatus = dashboard?.wallet?.status ?? "pending";
  const canPurchase = vendorStatus === "active" && walletStatus === "active" && Boolean(dashboard?.wallet?.id);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setErrorMessage("Enter a meter serial number or customer name.");
      return;
    }

    setSearching(true);
    setErrorMessage(null);

    try {
      const results = await vendorWalletService.searchMeters(searchTerm.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setSelectedMeter(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to search meters.");
      setSearchResults([]);
      setSelectedMeter(null);
    } finally {
      setSearching(false);
    }
  };

  const handleProceed = () => {
    if (!dashboard?.wallet?.id || !selectedMeter) {
      setErrorMessage("Select a customer meter before continuing.");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Enter a valid purchase amount.");
      return;
    }

    const draft: VendorPurchaseDraft = {
      idempotencyKey: createVendorIdempotencyKey(),
      walletId: dashboard.wallet.id,
      meterSn: selectedMeter.meterSn,
      customerRef: selectedMeter.customerRef,
      amount: parsedAmount,
      siteCode: selectedMeter.siteCode,
      customerName: selectedMeter.customerName,
      meterType: selectedMeter.meterType,
      accountStatus: selectedMeter.accountStatus,
      deliveryMethod,
      availableBalance: dashboard.wallet.availableBalance,
      walletStatus: dashboard.wallet.status,
      vendorStatus,
    };

    vendorWalletService.savePurchaseDraft(draft);
    navigate("/vendor/buy/confirm");
  };

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 className="vw-page-title">Buy Units</h1>
        <p className="vw-page-sub">Find a site-scoped meter, choose the delivery path, and stage the wallet debit.</p>
      </div>

      <VwStepBar steps={["Find Meter", "Confirm Debit", "Issue Receipt"]} current={0} />

      {!canPurchase ? (
        <VwInfoBox type="danger">
          <strong>Purchases are currently disabled.</strong> Vendor accounts can only purchase when both the vendor profile and wallet are active.
        </VwInfoBox>
      ) : null}
      <StatusMessage message={dashboardState.error} tone="danger" />
      <StatusMessage message={errorMessage} tone="danger" />

      {/* Search */}
      <div className="vw-surface vw-surface--padded">
        <div style={{ fontSize: 10, color: "var(--vw-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 4 }}>Step 1</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--vw-text)", marginBottom: 14 }}>Find Meter</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearch();
              }
            }}
            placeholder="Search meter serial number or customer name"
            type="text"
            value={searchTerm}
            style={{ flex: 1, padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", fontFamily: "var(--vw-font)", fontSize: 13 }}
          />
          <VwBtn disabled={searching} onClick={() => void handleSearch()} variant="primary">
            {searching ? "Searching…" : "Search"}
          </VwBtn>
        </div>

        {searchResults.length === 0 ? (
          <VendorEmptyState
            title="No meter selected"
            description="Run a search to load eligible meters from your assigned site."
          />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {searchResults.map((meter) => {
              const isSelected = selectedMeter?.id === meter.id;
              return (
                <div
                  key={meter.id}
                  onClick={() => setSelectedMeter(meter)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                    border: `${isSelected ? "2px" : "1px"} solid ${isSelected ? "var(--vw-primary)" : "var(--vw-border)"}`,
                    background: isSelected ? "var(--vw-primary-light)" : "var(--vw-surface)",
                    transition: "all 0.15s",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{meter.customerName}</div>
                    <div style={{ fontSize: 12, color: "var(--vw-muted)", fontFamily: "var(--vw-mono)" }}>{meter.meterSn}</div>
                    <div style={{ fontSize: 11, color: "var(--vw-faint)", marginTop: 2 }}>
                      {meter.meterType} · Last vended: {formatDateOnly(meter.lastVendedAt)}
                    </div>
                  </div>
                  <VwBadge variant={getStatusTone(meter.accountStatus)}>{meter.accountStatus}</VwBadge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Amount & Delivery */}
      <div className="vw-surface vw-surface--padded">
        <div style={{ fontSize: 10, color: "var(--vw-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 4 }}>Step 2</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--vw-text)", marginBottom: 14 }}>Amount and Delivery</div>

        <div className="vw-field" style={{ marginBottom: 14 }}>
          <label className="vw-field__label">Selected meter</label>
          <input
            disabled
            readOnly
            type="text"
            value={selectedMeter ? `${selectedMeter.customerName} — ${selectedMeter.meterSn}` : ""}
            placeholder="Pick a meter from search results"
            style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)", fontSize: 13, background: "var(--vw-bg)" }}
          />
        </div>

        <div className="vw-field" style={{ marginBottom: 14 }}>
          <label className="vw-field__label">Amount (NGN) *</label>
          <input
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="5000"
            step="0.01"
            type="number"
            value={amount}
            style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid var(--vw-border2)", width: "100%", fontFamily: "var(--vw-font)", fontSize: 13 }}
          />
          <div className="vw-field__hint">Available balance: {NGN(dashboard?.wallet?.availableBalance ?? 0)}</div>
        </div>

        <label className="vw-field__label" style={{ marginBottom: 8 }}>Delivery method *</label>
        <div className="vw-delivery-grid">
          <div
            className={`vw-delivery-card vw-delivery-card--remote${deliveryMethod === "remote_send" ? " vw-delivery-card--selected" : ""}`}
            onClick={() => setDeliveryMethod("remote_send")}
          >
            <div className="vw-delivery-card__emoji">📡</div>
            <div className="vw-delivery-card__title">Send directly to meter</div>
            <div className="vw-delivery-card__desc">Units go electronically to the customer's meter. No token is required.</div>
            {deliveryMethod === "remote_send" && <div className="vw-delivery-card__check" style={{ color: "var(--vw-lemon-text)" }}>✓ Selected</div>}
          </div>
          <div
            className={`vw-delivery-card vw-delivery-card--token${deliveryMethod === "token_generate" ? " vw-delivery-card--selected" : ""}`}
            onClick={() => setDeliveryMethod("token_generate")}
          >
            <div className="vw-delivery-card__emoji">🔢</div>
            <div className="vw-delivery-card__title">Generate token</div>
            <div className="vw-delivery-card__desc">A vend token is issued for manual keypad entry on the meter.</div>
            {deliveryMethod === "token_generate" && <div className="vw-delivery-card__check" style={{ color: "var(--vw-primary)" }}>✓ Selected</div>}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <VwBtn disabled={!canPurchase} onClick={handleProceed} variant="primary">
            Debit {amount.trim().length > 0 ? NGN(Number(amount) || 0) : "NGN 0"} from wallet
          </VwBtn>
        </div>
      </div>
    </div>
  );
}

export function VendorBuyConfirmView() {
  const navigate = useNavigate();
  const [draft] = useState<VendorPurchaseDraft | null>(() => vendorWalletService.readPurchaseDraft());
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!draft) {
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <h1 className="vw-page-title">Confirm Purchase</h1>
        <VendorEmptyState
          title="No purchase draft found"
          description="Start from the Buy Units screen to search a meter and stage a debit."
          action={<VwBtn onClick={() => navigate("/vendor/buy")} variant="primary">Go to Buy Units</VwBtn>}
        />
      </div>
    );
  }

  const handleConfirm = async () => {
    setBusy(true);
    setErrorMessage(null);

    try {
      const payload = {
        idempotencyKey: draft.idempotencyKey,
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

      vendorWalletService.clearPurchaseDraft();

      if (result.receiptId) {
        try {
          const receiptDetail = await vendorWalletService.loadReceipt(result.receiptId);
          vendorWalletService.cacheReceiptDetail(receiptDetail);
        } catch {
          // Receipt page can attempt its own fetch.
        }
        navigate(`/vendor/buy/receipt/${result.receiptId}`);
        return;
      }

      navigate("/vendor/receipts");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete purchase.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <h1 className="vw-page-title">Confirm Purchase</h1>
      <p className="vw-page-sub">Make sure the meter, amount, and delivery path are correct before debiting.</p>

      <VwStepBar steps={["Find Meter", "Confirm Debit", "Issue Receipt"]} current={1} />
      <StatusMessage message={errorMessage} tone="danger" />

      <div className="vw-surface vw-surface--padded">
        <VendorKeyValueGrid
          columns={3}
          items={[
            { label: "Meter SN", value: draft.meterSn },
            { label: "Customer Ref", value: draft.customerRef },
            { label: "Customer", value: draft.customerName },
            { label: "Meter Type", value: draft.meterType },
            { label: "Delivery Method", value: draft.deliveryMethod },
            { label: "Available Balance", value: NGN(draft.availableBalance) },
          ]}
        />
        <VwInfoBox type="warning" icon={<span>⚠️</span>}>
          This action will immediately debit <strong>{NGN(draft.amount)}</strong> from your wallet.
        </VwInfoBox>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <VwBtn onClick={() => navigate("/vendor/buy")} variant="outline">Edit Purchase</VwBtn>
          <VwBtn disabled={busy} onClick={() => void handleConfirm()} variant="primary">
            {busy ? "Processing…" : "Confirm Debit"}
          </VwBtn>
        </div>
      </div>
    </div>
  );
}

export function VendorReceiptView() {
  const navigate = useNavigate();
  const { receiptId } = useParams();
  const [state, setState] = useState<AsyncState<VendorReceiptDetailResponse>>(createAsyncState());

  useEffect(() => {
    let cancelled = false;

    async function loadReceipt() {
      if (!receiptId) {
        setState({ data: null, error: "No receipt id was provided.", loading: false });
        return;
      }

      try {
        const data = await vendorWalletService.loadReceipt(receiptId);
        if (!cancelled) {
          vendorWalletService.cacheReceiptDetail(data);
          setState({ data, error: null, loading: false });
        }
      } catch (error) {
        const cached = vendorWalletService.readCachedReceiptDetail();
        if (!cancelled) {
          setState({
            data: cached?.receipt.id === receiptId ? cached : null,
            error: error instanceof Error ? error.message : "Unable to load the receipt.",
            loading: false,
          });
        }
      }
    }

    void loadReceipt();

    return () => {
      cancelled = true;
    };
  }, [receiptId]);

  if (state.loading) {
    return <VendorLoadingPanel label="Loading vending receipt..." />;
  }

  if (!state.data) {
    return (
      <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
        <h1 className="vw-page-title">Purchase Receipt</h1>
        <StatusMessage message={state.error} tone="danger" />
        <VendorEmptyState
          title="Receipt unavailable"
          description="The receipt could not be retrieved. Try again from the receipts archive."
          action={<VwBtn onClick={() => navigate("/vendor/receipts")} variant="primary">Open Receipts</VwBtn>}
        />
      </div>
    );
  }

  const receipt = state.data.receipt;
  const isTokenReceipt = receipt.deliveryMethod === "token_generate";

  return (
    <div className="vendor-wallet-stack" style={{ padding: "24px" }}>
      <h1 className="vw-page-title">Purchase Receipt</h1>
      <p className="vw-page-sub">Print or retrieve again from the receipts archive.</p>

      <VwStepBar steps={["Find Meter", "Confirm Debit", "Issue Receipt"]} current={2} />
      <StatusMessage message={state.error} tone="neutral" />

      <div className="vw-receipt-success">
        <div className="vw-receipt-success__header">
          <div className="vw-receipt-success__check">
            <svg width="24" height="24" fill="none" stroke="#4ade80" strokeWidth="3" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="vw-receipt-success__title">
            VENDING RECEIPT {isTokenReceipt ? "TOKEN" : "REMOTE SEND"}
          </div>
          <div className="vw-receipt-success__sub">{BEVERLY_RECEIPT_BRAND.companyName}</div>
        </div>

        <div className="vw-receipt-success__body">
          <div className="vw-receipt-success__brand">
            <span className="vw-receipt-success__brand-name">{BEVERLY_RECEIPT_BRAND.website}</span>
            <span className="vw-receipt-success__brand-ref">{receipt.receiptNumber}</span>
          </div>

          <VwConfirmTable
            rows={[
              { key: "Receipt No", value: receipt.receiptNumber, mono: true },
              { key: "Date / Time", value: formatDateTime(receipt.issuedAt) },
              { key: "Vendor", value: state.data.receipt.vendorName ?? "--" },
              { key: "Vendor Code", value: state.data.receipt.vendorCode ?? "--" },
              { key: "Site", value: state.data.receipt.siteName ?? receipt.siteCode },
              { key: "Meter SN", value: receipt.meterSn, mono: true },
              { key: "Customer", value: state.data.receipt.customerName ?? "--" },
              { key: "Account Ref", value: receipt.customerRef ?? "--" },
              { key: isTokenReceipt ? "Amount" : "Amount Sent", value: NGN(receipt.amount), primary: true },
              {
                key: isTokenReceipt ? "Status" : "Delivery Ref",
                value: isTokenReceipt ? state.data.receipt.statusLabel ?? "Issued" : receipt.remoteSendRef ?? "--",
              },
            ]}
          />

          {isTokenReceipt ? (
            <div className="vw-token-display">
              <div className="vw-token-display__eyebrow">🔢 Token — Enter on Meter Keypad</div>
              <div className="vw-token-display__code">{formatTokenValue(receipt.tokenValue)}</div>
              <div className="vw-token-display__hint">Ask your customer to enter this 20-digit code on the meter keypad.</div>
            </div>
          ) : null}

          <p style={{ marginTop: 16, color: "var(--vw-faint)", fontSize: 12 }}>
            This receipt is issued by {BEVERLY_RECEIPT_BRAND.companyName}. For support, contact{" "}
            {BEVERLY_RECEIPT_BRAND.email} or {BEVERLY_RECEIPT_BRAND.primaryPhone}.
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <VwBtn onClick={() => window.print()} variant="outline">🖨️ Print Receipt</VwBtn>
            <VwBtn onClick={() => navigate("/vendor/buy")} variant="primary">New Purchase</VwBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
