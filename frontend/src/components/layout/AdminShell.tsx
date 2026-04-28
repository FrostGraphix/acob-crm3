import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpCircle,
  BarChart2,
  BookOpen,
  CheckSquare,
  FileText,
  Flag,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Search,
  Settings,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { request } from "../../services/api";
import { normalizeTableData } from "../../services/table-data";
import type { AppPageConfig } from "../../types";
import { NotificationBell } from "./NotificationBell";

type WalletWorkspaceMode = "vendor" | "wallet-admin";

interface WalletShellNavItem {
  badge?: number;
  danger?: boolean;
  icon: typeof LayoutDashboard;
  keywords?: string[];
  label: string;
  path: string;
  section?: string;
}

interface WalletShellSidebarProps {
  currentPath: string;
  isOpen?: boolean;
  mode: WalletWorkspaceMode;
  onLogout: () => Promise<void>;
  onNavigate: (path: string) => void;
}

interface WalletShellTopbarProps {
  currentPage: AppPageConfig;
  mode: WalletWorkspaceMode;
  onNavigate: (path: string) => void;
}

interface PaletteItem {
  group: string;
  id: string;
  keywords: string;
  path: string;
  subtitle: string;
  title: string;
}

const walletVendorNav: WalletShellNavItem[] = [
  { section: "Overview", label: "Dashboard", path: "/vendor/dashboard", icon: LayoutDashboard, keywords: ["overview", "home"] },
  { section: "Transactions", label: "Buy Units", path: "/vendor/buy", icon: Zap, keywords: ["token", "purchase", "vend"] },
  { label: "Fund Wallet", path: "/vendor/topup", icon: ArrowUpCircle, keywords: ["top up", "funding"] },
  { label: "Transactions", path: "/vendor/transactions", icon: Activity, keywords: ["ledger", "history"] },
  { label: "Receipts", path: "/vendor/receipts", icon: Receipt, keywords: ["receipts", "proof"] },
  { label: "Statement", path: "/vendor/statement", icon: FileText, keywords: ["statement", "export"] },
  { section: "Account", label: "My Profile", path: "/vendor/profile", icon: Settings, keywords: ["account", "profile"] },
];

const walletAdminNav: WalletShellNavItem[] = [
  { section: "Overview", label: "Dashboard", path: "/wallet-admin/overview", icon: LayoutDashboard, keywords: ["finance dashboard", "overview"] },
  { section: "Vendors", label: "Vendors", path: "/wallet-admin/vendor-onboarding", icon: Users, badge: 4, keywords: ["vendor onboarding", "kyc", "accounts"] },
  { label: "All Wallets", path: "/wallet-admin/wallet-kpis", icon: Wallet, keywords: ["wallets", "float", "balances"] },
  { section: "Finance", label: "Funding & Credits", path: "/wallet-admin/funding-pending", icon: CheckSquare, badge: 3, keywords: ["funding", "credits", "approvals"] },
  { label: "Purchase Monitor", path: "/wallet-admin/purchase-monitor", icon: Package, keywords: ["transactions", "purchases", "monitor"] },
  { section: "Operations", label: "Exceptions", path: "/wallet-admin/exceptions", icon: Flag, badge: 2, danger: true, keywords: ["exceptions", "sla", "escalation"] },
  { label: "Settlement", path: "/wallet-admin/settlement-batches", icon: BarChart2, keywords: ["settlement", "batches"] },
  { section: "Reports", label: "Audit Log", path: "/wallet-admin/reconciliation", icon: BookOpen, keywords: ["audit", "reconciliation", "reports"] },
];

function getWalletNav(mode: WalletWorkspaceMode) {
  return mode === "vendor" ? walletVendorNav : walletAdminNav;
}

function isWalletPathActive(itemPath: string, currentPath: string) {
  if (currentPath === itemPath) {
    return true;
  }

  if (itemPath === "/vendor/topup" && currentPath.startsWith("/vendor/topup/")) {
    return true;
  }

  if (itemPath === "/vendor/buy" && currentPath.startsWith("/vendor/buy/")) {
    return true;
  }

  return false;
}

function readText(record: Record<string, unknown>, keys: string[], fallback = "--") {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) {
      continue;
    }

    const text = String(value).trim();
    if (text.length > 0) {
      return text;
    }
  }

  return fallback;
}

function buildPageItems(): PaletteItem[] {
  return walletAdminNav.map((item) => ({
    id: `page-${item.path}`,
    group: "Pages",
    title: item.label,
    subtitle: item.section ? `${item.section} workspace` : "Admin workspace",
    path: item.path,
    keywords: [item.label, item.section, ...(item.keywords ?? [])].filter(Boolean).join(" ").toLowerCase(),
  }));
}

function WalletAdminCommandPalette({
  onClose,
  onNavigate,
  open,
}: {
  onClose: () => void;
  onNavigate: (path: string) => void;
  open: boolean;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PaletteItem[]>(() => buildPageItems());
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);

    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadItems() {
      setLoading(true);

      const [vendorsResult, walletsResult, transactionsResult] = await Promise.allSettled([
        request<unknown>("/api/vendor/onboarding/queue", { method: "GET" }),
        request<unknown>("/api/wallet/finance/kpis", { method: "GET" }),
        request<unknown>("/api/wallet/transactions", { method: "GET", query: { limit: 12 } }),
      ]);

      if (cancelled) {
        return;
      }

      const nextItems = [...buildPageItems()];

      if (vendorsResult.status === "fulfilled") {
        const vendorRows = normalizeTableData(vendorsResult.value, "/api/vendor/onboarding/queue").rows;
        nextItems.push(
          ...vendorRows.slice(0, 16).map((row, index) => {
            const vendorName = readText(row, ["vendorName", "businessName", "displayName", "legalName"], "Vendor");
            const vendorCode = readText(row, ["vendorCode", "code"], `VND-${index + 1}`);
            const siteCode = readText(row, ["siteCode", "siteName"], "Unassigned");
            return {
              id: `vendor-${vendorCode}-${index}`,
              group: "Vendors",
              title: vendorName,
              subtitle: `${vendorCode} · ${siteCode}`,
              path: "/wallet-admin/vendor-onboarding",
              keywords: `${vendorName} ${vendorCode} ${siteCode} vendor account kyc`,
            };
          }),
        );
      }

      if (walletsResult.status === "fulfilled") {
        const walletRows = normalizeTableData(walletsResult.value, "/api/wallet/finance/kpis").rows;
        nextItems.push(
          ...walletRows.slice(0, 16).map((row, index) => {
            const vendorName = readText(row, ["vendorName", "businessName", "displayName", "legalName"], "Vendor Wallet");
            const vendorCode = readText(row, ["vendorCode", "code"], `WLT-${index + 1}`);
            const status = readText(row, ["status", "accountStatus"], "Active");
            return {
              id: `wallet-${vendorCode}-${index}`,
              group: "Wallets",
              title: vendorName,
              subtitle: `${vendorCode} · ${status}`,
              path: "/wallet-admin/wallet-kpis",
              keywords: `${vendorName} ${vendorCode} ${status} wallet float balance`,
            };
          }),
        );
      }

      if (transactionsResult.status === "fulfilled") {
        const transactionRows = normalizeTableData(transactionsResult.value, "/api/wallet/transactions").rows;
        nextItems.push(
          ...transactionRows.slice(0, 16).map((row, index) => {
            const reference = readText(row, ["reference", "receiptNumber", "id"], `TX-${index + 1}`);
            const description = readText(row, ["description", "vendorName", "customerName"], "Wallet transaction");
            const status = readText(row, ["status"], "Posted");
            return {
              id: `transaction-${reference}-${index}`,
              group: "Transactions",
              title: reference,
              subtitle: `${description} · ${status}`,
              path: "/wallet-admin/purchase-monitor",
              keywords: `${reference} ${description} ${status} transaction purchase monitor`,
            };
          }),
        );
      }

      setItems(nextItems);
      setLoading(false);
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return items.slice(0, 12);
    }

    return items
      .filter((item) => `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase().includes(normalizedQuery))
      .slice(0, 16);
  }, [items, query]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, PaletteItem[]>();
    for (const item of filteredItems) {
      if (!groups.has(item.group)) {
        groups.set(item.group, []);
      }
      groups.get(item.group)?.push(item);
    }
    return [...groups.entries()];
  }, [filteredItems]);

  const handleSelect = (path: string) => {
    onNavigate(path);
    onClose();
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }

    if (event.key === "Enter" && filteredItems[0]) {
      event.preventDefault();
      handleSelect(filteredItems[0].path);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="wallet-command-palette__overlay" onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className="wallet-command-palette"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="wallet-command-palette__header">
          <div className="wallet-command-palette__search-wrap">
            <Search className="wallet-command-palette__search-icon" size={16} />
            <input
              className="wallet-command-palette__input"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search vendors, wallets, transactions..."
              ref={inputRef}
              type="text"
              value={query}
            />
          </div>
          <button className="wallet-command-palette__close" onClick={onClose} type="button">
            Esc
          </button>
        </div>

        <div className="wallet-command-palette__meta">
          <span>Global Search</span>
          <span>{loading ? "Syncing workspace index..." : `${filteredItems.length} results`}</span>
        </div>

        <div className="wallet-command-palette__results">
          {groupedItems.length === 0 ? (
            <div className="wallet-command-palette__empty">No matching wallet-admin results found.</div>
          ) : (
            groupedItems.map(([group, groupItems]) => (
              <div className="wallet-command-palette__group" key={group}>
                <div className="wallet-command-palette__group-label">{group}</div>
                {groupItems.map((item) => (
                  <button
                    className="wallet-command-palette__item"
                    key={item.id}
                    onClick={() => handleSelect(item.path)}
                    type="button"
                  >
                    <div className="wallet-command-palette__item-copy">
                      <div className="wallet-command-palette__item-title">{item.title}</div>
                      <div className="wallet-command-palette__item-subtitle">{item.subtitle}</div>
                    </div>
                    <div className="wallet-command-palette__item-hint">Open</div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function WalletShellSidebar({
  currentPath,
  isOpen,
  mode,
  onLogout,
  onNavigate,
}: WalletShellSidebarProps) {
  const { user } = useAuth();
  const navItems = getWalletNav(mode);
  const operatorName = user?.displayName ?? user?.username ?? (mode === "vendor" ? "Vendor User" : "Finance Admin");
  const operatorRole = user?.role ?? (mode === "vendor" ? "vendor_user" : "super_admin");
  const operatorInitials =
    operatorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? "")
      .join("") || "AW";
  const workspaceStripLabel =
    mode === "vendor"
      ? `${user?.siteCode ?? "Assigned Site"} · ${user?.username ?? "VENDOR"}`
      : "Finance Admin";

  return (
    <aside className={`sidebar wallet-shell-sidebar ${isOpen ? "open" : ""}`}>
      <div className="wallet-shell-sidebar__scroll">
        <div className="wallet-shell-sidebar__brand">
          <div className="wallet-shell-sidebar__logo">B</div>
          <div className="wallet-shell-sidebar__brand-copy">
            <div className="wallet-shell-sidebar__brand-title">Beverly</div>
            <div className="wallet-shell-sidebar__brand-subtitle">Technology Ltd</div>
          </div>
        </div>

        <div className="wallet-shell-sidebar__workspace">
          <div className={`wallet-shell-sidebar__workspace-pill ${mode === "wallet-admin" ? "is-admin" : "is-vendor"}`}>
            <span className="wallet-shell-sidebar__workspace-dot" />
            <span>{workspaceStripLabel}</span>
          </div>
        </div>

        <nav className="wallet-shell-sidebar__nav">
          {navItems.map((item) => {
            const active = isWalletPathActive(item.path, currentPath);
            const Icon = item.icon;

            return item.section ? (
              <div key={`${item.section}-${item.path}`}>
                <div className="wallet-shell-sidebar__section">{item.section}</div>
                <button className={`wallet-shell-sidebar__item ${active ? "is-active" : ""}`} onClick={() => onNavigate(item.path)} type="button">
                  <span className="wallet-shell-sidebar__item-main">
                    <Icon className="wallet-shell-sidebar__item-icon" size={14} />
                    <span className="wallet-shell-sidebar__item-label">{item.label}</span>
                  </span>
                  {item.badge ? (
                    <span className={`wallet-shell-sidebar__badge ${item.danger ? "is-danger" : ""}`}>{item.badge}</span>
                  ) : null}
                </button>
              </div>
            ) : (
              <button className={`wallet-shell-sidebar__item ${active ? "is-active" : ""}`} key={item.path} onClick={() => onNavigate(item.path)} type="button">
                <span className="wallet-shell-sidebar__item-main">
                  <Icon className="wallet-shell-sidebar__item-icon" size={14} />
                  <span className="wallet-shell-sidebar__item-label">{item.label}</span>
                </span>
                {item.badge ? (
                  <span className={`wallet-shell-sidebar__badge ${item.danger ? "is-danger" : ""}`}>{item.badge}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="wallet-shell-sidebar__footer">
          <div className="wallet-shell-sidebar__user">
            <div className="wallet-shell-sidebar__avatar">{operatorInitials}</div>
            <div>
              <div className="wallet-shell-sidebar__user-name">{operatorName}</div>
              <div className="wallet-shell-sidebar__user-role">{operatorRole}</div>
            </div>
          </div>
          <button className="wallet-shell-sidebar__signout" onClick={() => void onLogout()} type="button">
            <LogOut size={12} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export function WalletShellTopbar({
  currentPage,
  mode,
  onNavigate,
}: WalletShellTopbarProps) {
  const { user } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const operatorName = user?.displayName ?? user?.username ?? "Operator";
  const operatorInitials =
    operatorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? "")
      .join("") || "OP";

  useEffect(() => {
    if (mode !== "wallet-admin") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  return (
    <>
      <header className="crm-header wallet-shell-topbar">
        <div className="wallet-shell-topbar__copy">
          <div className="wallet-shell-topbar__title">{currentPage.title}</div>
          <div className="wallet-shell-topbar__sub">{currentPage.description}</div>
        </div>

        <div className="wallet-shell-topbar__actions">
          {mode === "wallet-admin" ? (
            <button
              className="wallet-shell-topbar__portal"
              onClick={() => onNavigate("/vendor/login")}
              type="button"
            >
              <ArrowRight size={15} />
              <span>Vendor Portal</span>
            </button>
          ) : null}

          <div className="wallet-shell-topbar__bell">
            <NotificationBell />
          </div>

          <button
            className={`wallet-shell-topbar__avatar ${mode === "vendor" ? "is-vendor" : "is-admin"}`}
            onClick={() => onNavigate(mode === "vendor" ? "/vendor/profile" : "/profile")}
            title={`${operatorName} profile`}
            type="button"
          >
            {operatorInitials}
          </button>
        </div>
      </header>

      {mode === "wallet-admin" ? (
        <WalletAdminCommandPalette
          onClose={() => setPaletteOpen(false)}
          onNavigate={onNavigate}
          open={paletteOpen}
        />
      ) : null}
    </>
  );
}
