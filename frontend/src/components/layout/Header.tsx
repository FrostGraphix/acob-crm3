import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../design-system";
import type { AppPageConfig } from "../../types";
import { ThemeToggle } from "../common/ThemeToggle";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps {
  currentPage: AppPageConfig;
  isSidebarCollapsed: boolean;
  onLogout: () => Promise<void>;
  onNavigate: (path: string) => void;
  onToggleMenu: () => void;
  onToggleSidebarCollapse: () => void;
}

export function Header({
  currentPage,
  isSidebarCollapsed,
  onLogout: _onLogout,
  onNavigate,
  onToggleMenu: _onToggleMenu,
  onToggleSidebarCollapse,
}: HeaderProps) {
  const { user } = useAuth();
  const isWalletAdminView = (currentPage.workspace ?? "operations") === "wallet-admin";
  const isVendorWalletView = (currentPage.workspace ?? "operations") === "vendor";
  const isWalletWorkspace = isWalletAdminView || isVendorWalletView;
  const isAdmin = user?.role?.toLowerCase().includes("admin") ?? false;
  const operatorName = user?.displayName ?? user?.username ?? "Operator";
  const operatorInitials = operatorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("") || "OP";

  if (isWalletWorkspace) {
    return (
      <header className="crm-header wallet-shell-topbar">
        <div className="wallet-shell-topbar__copy">
          <div className="wallet-shell-topbar__title">{currentPage.title}</div>
          <div className="wallet-shell-topbar__sub">{currentPage.description}</div>
        </div>

        <div className="wallet-shell-topbar__actions">
          {isWalletAdminView ? (
            <Button onClick={() => onNavigate("/dashboard")} tone="ghost" size="sm">
              CRM Workspace
            </Button>
          ) : null}

          <div className="wallet-shell-topbar__bell">
            <NotificationBell />
          </div>

          <button
            className="wallet-shell-topbar__avatar"
            onClick={() => onNavigate(isVendorWalletView ? "/vendor/profile" : "/profile")}
            title={`${operatorName} profile`}
            type="button"
          >
            {operatorInitials}
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="crm-header crm-header--dashboard">
      <div className="header-primary header-primary--dashboard">
        <Button
          className="button-icon-only desktop-sidebar-toggle"
          onClick={onToggleSidebarCollapse}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          size="icon"
          tone="ghost"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="18" height="18">
            {isSidebarCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            )}
          </svg>
        </Button>



        <div className="header-copy header-copy--dashboard">
          <span className="header-dashboard-title">
            {currentPage.title}
          </span>
        </div>
      </div>

      <div className="header-controls header-controls--dashboard">
        {isWalletAdminView && (
          <Button onClick={() => onNavigate("/dashboard")} tone="ghost" size="sm">
            CRM Workspace
          </Button>
        )}
        
        <ThemeToggle />
        <NotificationBell />
        
        {isAdmin && (
          <Button
            className="header-icon-button"
            onClick={() => onNavigate("/system/runtime")}
            size="icon"
            tone="ghost"
            title="Runtime operations"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3v6m0 6v6m9-9h-6M9 12H3m15.364-6.364l-4.243 4.243M9.88 14.12l-4.244 4.244m0-12.728l4.244 4.243m8.484 8.485l-4.243-4.244" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
          </Button>
        )}

        <button
          className="header-avatar-btn"
          onClick={() => onNavigate("/profile")}
          title={`${operatorName} profile`}
          type="button"
        >
          <div className="header-avatar">
            {operatorInitials}
            <span className="header-avatar-status" />
          </div>
        </button>
      </div>
    </header>
  );
}
