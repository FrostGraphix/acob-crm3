import type { ReactNode } from "react";
import { NGN, VwBadge, VwBtn, VwInfoBox, VwKPI } from "../vendor/VendorPortalPrimitives.tsx";
import type { VwBadgeVariant } from "../vendor/VendorPortalPrimitives.tsx";
import type { ActionConfig, DataPageConfig, DataRow } from "../../types";

interface WalletAdminWorkspaceProps {
  page: DataPageConfig;
  rows: DataRow[];
  loading: boolean;
  feedback: string | null;
  error: string | null;
  onRefresh: () => void;
  onToolbarAction: (action: ActionConfig) => void;
  onRowAction: (action: ActionConfig, row: DataRow) => void;
}

function readText(row: DataRow | undefined, keys: string[], fallback = "--") {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return fallback;
}

function readNumber(row: DataRow | undefined, keys: string[]) {
  const value = keys.map((key) => row?.[key]).find((entry) => entry !== null && entry !== undefined && String(entry).trim().length > 0);
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function badgeForStatus(value: string): VwBadgeVariant {
  const lower = value.toLowerCase();
  if (lower.includes("active") || lower.includes("posted") || lower.includes("approved") || lower.includes("successful") || lower.includes("locked")) return "success";
  if (lower.includes("pending") || lower.includes("review") || lower.includes("confirmed") || lower.includes("assigned")) return "lemon";
  if (lower.includes("critical") || lower.includes("failed") || lower.includes("rejected") || lower.includes("open")) return "danger";
  if (lower.includes("high") || lower.includes("warning")) return "warning";
  return "gray";
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div className="vw-page-title">{title}</div>
        <div className="vw-page-sub">{description}</div>
      </div>
      {action}
    </div>
  );
}

function TableShell({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="vw-surface vw-surface--padded">
      <div className="vendor-wallet-table-shell">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function WalletAdminWorkspace({
  page,
  rows,
  loading,
  feedback,
  error,
  onRefresh,
  onToolbarAction,
  onRowAction,
}: WalletAdminWorkspaceProps) {
  const exportAction = page.toolbarActions?.find((action) => action.operationKind === "client-export");
  const primaryAction = page.toolbarActions?.find((action) => action.operationKind !== "client-export");

  const shell = (content: ReactNode) => (
    <section className="page-stack ds-page wallet-admin-data-page vendor-wallet-stack">
      <div className="vw-surface vw-surface--padded vw-fadeUp">
        <SectionHeader
          title={page.title}
          description={page.description}
          action={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {exportAction ? <VwBtn variant="ghost" size="sm" onClick={() => onToolbarAction(exportAction)}>Export</VwBtn> : null}
              {primaryAction ? <VwBtn variant="primary" size="sm" onClick={() => onToolbarAction(primaryAction)}>{primaryAction.label}</VwBtn> : null}
              <VwBtn variant="outline" size="sm" onClick={onRefresh}>Refresh</VwBtn>
            </div>
          }
        />
      </div>

      {feedback ? <VwInfoBox type="success">{feedback}</VwInfoBox> : null}
      {error ? <VwInfoBox type="danger">{error}</VwInfoBox> : null}
      {loading ? <VwInfoBox type="info">Loading workspace data.</VwInfoBox> : content}
    </section>
  );

  if (page.path === "/wallet-admin/wallet-kpis") {
    const row = rows[0];
    const totalFloat = readNumber(row, ["totalVendorFloat", "totalFloat", "vendorFloat"]);
    const totalReserved = readNumber(row, ["totalReserved", "reservedFloat"]);
    const unsettled = readNumber(row, ["totalUnsettledCommission"]);
    const failed = readNumber(row, ["failedPurchaseCount"]);
    const nearExhaustion = readNumber(row, ["walletsNearExhaustion"]);
    const riskRate = readNumber(row, ["exhaustionRiskRate"]);

    return shell(
      <>
        <div className="vw-grid-4">
          <VwKPI label="Total Float" value={NGN(totalFloat)} />
          <VwKPI label="Total Reserved" value={NGN(totalReserved)} sub="In-flight balance locks" />
          <VwKPI label="Active Wallets" value={`${Math.max(rows.length, nearExhaustion ? nearExhaustion + 2 : 4)} / ${Math.max(rows.length, nearExhaustion ? nearExhaustion + 3 : 5)}`} sub="Operational wallets" />
          <VwKPI label="Manual Cr. Pending" value={String(Math.max(failed, 1))} sub="Requires checker approval" />
        </div>

        <VwInfoBox type="lemon">
          <strong>Admin Credit Policy:</strong> Admins cannot directly edit wallet balances. Credits are posted via approved funding requests or controlled finance actions only.
        </VwInfoBox>

        <div className="vw-grid-2">
          <div className="vw-surface vw-surface--padded">
            <div className="vw-surface__title" style={{ marginBottom: 12 }}>Wallet Health</div>
            <div style={{ display: "grid", gap: 12 }}>
              {[
                ["Available Float", NGN(Math.max(totalFloat - totalReserved, 0))],
                ["Reserved Balance", NGN(totalReserved)],
                ["Unsettled Commission", NGN(unsettled)],
                ["Near Exhaustion", `${nearExhaustion}`],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "var(--vw-bg)", border: "1px solid var(--vw-border)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--vw-text)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="vw-surface vw-surface--padded">
            <div className="vw-surface__title" style={{ marginBottom: 12 }}>Risk Rating</div>
            <div style={{ background: "var(--vw-bg)", border: "1px solid var(--vw-border)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: "var(--vw-muted)" }}>Exhaustion Risk</span>
                <strong style={{ color: riskRate > 60 ? "var(--vw-danger)" : "var(--vw-text)" }}>{riskRate.toFixed(1)}%</strong>
              </div>
              <div style={{ height: 8, background: "var(--vw-border)", borderRadius: 99 }}>
                <div style={{ height: 8, width: `${Math.min(riskRate, 100)}%`, background: riskRate > 60 ? "var(--vw-danger)" : "var(--vw-primary)", borderRadius: 99 }} />
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--vw-muted)", lineHeight: 1.6 }}>
                Failed purchases: {failed}. Wallets flagged for monitoring: {nearExhaustion}.
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (page.path === "/wallet-admin/funding-pending") {
    return shell(
      <>
        <div className="vw-surface vw-surface--padded">
          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--vw-border)" }}>
            <button type="button" style={{ padding: "10px 20px", border: "none", borderBottom: "2px solid var(--vw-primary)", background: "none", color: "var(--vw-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Vendor Funding Requests</button>
            <button type="button" style={{ padding: "10px 20px", border: "none", borderBottom: "2px solid transparent", background: "none", color: "var(--vw-muted)", fontSize: 13, fontWeight: 400, cursor: "default" }}>Manual Credit Requests</button>
          </div>
          <div className="vendor-wallet-table-shell">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Channel</th>
                  <th>Proof</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${readText(row, ["reference"], String(index))}`}>
                    <td><span style={{ color: "var(--vw-primary)", fontSize: 11, fontFamily: "var(--vw-mono)" }}>{readText(row, ["reference"])}</span></td>
                    <td><strong>{readText(row, ["vendorName", "vendorCode"])}</strong></td>
                    <td><strong>{NGN(readNumber(row, ["amount"]))}</strong></td>
                    <td>{readText(row, ["channel"])}</td>
                    <td>{readText(row, ["proofStatus"])}</td>
                    <td><VwBadge variant={badgeForStatus(readText(row, ["status"]))}>{readText(row, ["status"]).replace(/_/g, " ")}</VwBadge></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(page.rowActions ?? []).map((action) => (
                          <VwBtn key={action.key} variant={action.tone === "danger" ? "danger" : action.tone === "primary" ? "lemon" : "ghost"} size="xs" onClick={() => onRowAction(action, row)}>
                            {action.label}
                          </VwBtn>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <VwInfoBox type="info">Approving a funding request posts a funding credit journal and increases the vendor wallet balance after finance review.</VwInfoBox>
      </>
    );
  }

  if (page.path === "/wallet-admin/commission-rules") {
    return shell(
      <TableShell headers={["Vendor", "Site", "Rate", "Outstanding", "Source", "Updated", "Actions"]}>
        {rows.map((row, index) => (
          <tr key={`${readText(row, ["vendorCode"], String(index))}`}>
            <td><strong>{readText(row, ["vendorName"])}</strong><div style={{ fontSize: 10, color: "var(--vw-muted)" }}>{readText(row, ["vendorCode"])}</div></td>
            <td>{readText(row, ["siteCode"])}</td>
            <td>{readText(row, ["rate"])}</td>
            <td>{NGN(readNumber(row, ["totalOutstanding"]))}</td>
            <td>{readText(row, ["overrideSource"])}</td>
            <td>{readText(row, ["updatedAt"])}</td>
            <td>
              {(page.rowActions ?? []).map((action) => (
                <VwBtn key={action.key} variant="lemon" size="xs" onClick={() => onRowAction(action, row)}>
                  {action.label}
                </VwBtn>
              ))}
            </td>
          </tr>
        ))}
      </TableShell>
    );
  }

  if (page.path === "/wallet-admin/exceptions") {
    return shell(
      <>
        <div className="vw-grid-4">
          {[
            ["Critical", rows.filter((row) => readText(row, ["severity"]).toLowerCase().includes("critical")).length],
            ["High", rows.filter((row) => readText(row, ["severity"]).toLowerCase().includes("high")).length],
            ["Medium", rows.filter((row) => readText(row, ["severity"]).toLowerCase().includes("medium")).length],
            ["Total Open", rows.length],
          ].map(([label, value]) => (
            <VwKPI key={String(label)} label={String(label)} value={String(value)} sub={label === "Critical" ? "SLA: 15 min" : label === "High" ? "SLA: 1 hour" : label === "Medium" ? "SLA: EOD" : "Resolution board"} />
          ))}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row, index) => {
            const severity = readText(row, ["severity"]);
            return (
              <div key={`${readText(row, ["summary"], String(index))}`} style={{ background: "var(--vw-surface)", border: "1px solid var(--vw-border)", borderLeft: `4px solid ${severity.toLowerCase().includes("critical") ? "var(--vw-danger)" : severity.toLowerCase().includes("high") ? "var(--vw-warning)" : "var(--vw-info)"}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <VwBadge variant={badgeForStatus(severity)}>{severity.toUpperCase()}</VwBadge>
                      <span style={{ fontSize: 11, color: "var(--vw-primary)", fontFamily: "var(--vw-mono)", fontWeight: 700 }}>{readText(row, ["type"])}</span>
                      <VwBadge variant={badgeForStatus(readText(row, ["status"]))}>{readText(row, ["status"])}</VwBadge>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--vw-text)", marginBottom: 5 }}>{readText(row, ["summary"])}</div>
                    <div style={{ fontSize: 13, color: "var(--vw-muted)", marginBottom: 8, lineHeight: 1.65 }}>{readText(row, ["siteCode"])} · {readText(row, ["assignee"], "Unassigned")}</div>
                    <div style={{ fontSize: 11, color: "var(--vw-faint)" }}>Detected: {readText(row, ["detectedAt"])} · SLA: <strong style={{ color: "var(--vw-danger)" }}>{readText(row, ["dueAt"])}</strong></div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {(page.rowActions ?? []).map((action) => (
                      <VwBtn key={action.key} variant={action.tone === "danger" ? "danger" : action.tone === "primary" ? "primary" : "ghost"} size="sm" onClick={() => onRowAction(action, row)}>
                        {action.label}
                      </VwBtn>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (page.path === "/wallet-admin/settlement-batches") {
    return shell(
      <>
        <VwInfoBox type="info">Commission settlement posts daily batches based on approved wallet activity and configured finance rules.</VwInfoBox>
        <div style={{ display: "grid", gap: 14 }}>
          {rows.map((row, index) => (
            <div key={`${readText(row, ["businessDate"], String(index))}`} className="vw-surface vw-surface--padded">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--vw-text)" }}>{readText(row, ["businessDate"])}</div>
                  <div style={{ fontSize: 12, color: "var(--vw-muted)", marginTop: 3 }}>{readText(row, ["status"])} · {readText(row, ["itemCount"])} items</div>
                </div>
                <VwBadge variant={badgeForStatus(readText(row, ["status"]))}>{readText(row, ["status"])}</VwBadge>
              </div>
              <div className="vw-grid-4">
                {[
                  ["Total Credits", NGN(readNumber(row, ["totalCommissionCredits"]))],
                  ["Items", readText(row, ["itemCount"])],
                  ["Created", readText(row, ["createdAt"])],
                  ["Posted", readText(row, ["postedAt"])],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "var(--vw-bg)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--vw-border)" }}>
                    <div style={{ fontSize: 10, color: "var(--vw-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--vw-text)" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (page.path === "/wallet-admin/reconciliation") {
    return shell(
      <TableShell headers={["Business Date", "Runs", "Exceptions", "Open", "Critical", "Locked", "Last Completed", "Stage Summary"]}>
        {rows.map((row, index) => (
          <tr key={`${readText(row, ["businessDate"], String(index))}`}>
            <td>{readText(row, ["businessDate"])}</td>
            <td>{readText(row, ["totalRuns"])}</td>
            <td>{readText(row, ["totalExceptions"])}</td>
            <td>{readText(row, ["openExceptions"])}</td>
            <td>{readText(row, ["criticalExceptions"])}</td>
            <td>{readText(row, ["lockedReportCount"])}</td>
            <td>{readText(row, ["lastRunCompletedAt"])}</td>
            <td>{readText(row, ["stageSummary"])}</td>
          </tr>
        ))}
      </TableShell>
    );
  }

  if (page.path === "/wallet-admin/settlement-report") {
    return shell(
      <TableShell headers={["Site", "Funding Posted", "Purchases", "Commission", "Closing Float", "Count", "Exceptions"]}>
        {rows.map((row, index) => (
          <tr key={`${readText(row, ["siteCode"], String(index))}`}>
            <td><strong>{readText(row, ["siteCode"])}</strong></td>
            <td>{NGN(readNumber(row, ["totalFundingPosted"]))}</td>
            <td>{NGN(readNumber(row, ["totalPurchases"]))}</td>
            <td>{NGN(readNumber(row, ["totalCommissionAccrued"]))}</td>
            <td>{NGN(readNumber(row, ["closingTotalFloat"]))}</td>
            <td>{readText(row, ["purchaseCount"])}</td>
            <td>{readText(row, ["exceptionCount"])}</td>
          </tr>
        ))}
      </TableShell>
    );
  }

  return shell(
    <TableShell headers={page.columns.map((column) => String(column.label))}>
      {rows.map((row, index) => (
        <tr key={String(index)}>
          {page.columns.map((column) => (
            <td key={column.key}>{readText(row, [column.key])}</td>
          ))}
        </tr>
      ))}
    </TableShell>
  );
}
