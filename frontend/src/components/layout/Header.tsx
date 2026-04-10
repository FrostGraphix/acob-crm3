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

const UserIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

const LogoutIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

const MenuIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6h16M4 12h16m-7 6h7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
  </svg>
);

export function Header({
  currentPage,
  isSidebarCollapsed,
  onLogout,
  onNavigate,
  onToggleMenu,
  onToggleSidebarCollapse,
}: HeaderProps) {
  const { user } = useAuth();
  const isDashboardView = currentPage.path === "/dashboard";
  const isAdmin = user?.role?.toLowerCase().includes("admin") ?? false;
  const operatorName = user?.displayName ?? user?.username ?? "Operator";
  const operatorRole = user?.role ?? "Administrator";
  const operatorInitials = operatorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("") || "OP";

  if (isDashboardView) {
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </Button>

          <Button
            className="button-icon-only mobile-menu-toggle"
            style={{ display: "none" }}
            onClick={onToggleMenu}
            size="icon"
            tone="ghost"
          >
            <MenuIcon />
          </Button>

          <div className="header-copy header-copy--dashboard">
            <span className="header-dashboard-title">{currentPage.title}</span>
          </div>
        </div>

        <div className="header-controls header-controls--dashboard">
          <div className="header-dashboard-live">
            <span className="header-dashboard-live__dot" />
            <span>Live</span>
          </div>
          <NotificationBell />
          <Button
            className="header-dashboard-avatar"
            onClick={() => onNavigate("/profile")}
            size="icon"
            tone="ghost"
            title={`${operatorName} profile`}
          >
            <span>{operatorInitials}</span>
            <span className="sr-only">{operatorRole}</span>
          </Button>
        </div>
      </header>
    );
  }

  return (
    <header className="crm-header">
      <div className="header-primary">
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </Button>
        
        <Button
          className="button-icon-only mobile-menu-toggle"
          style={{ display: 'none' }}
          onClick={onToggleMenu}
          size="icon"
          tone="ghost"
        >
          <MenuIcon />
        </Button>

        <div className="header-copy">
          <span className="header-eyebrow">Workspace</span>
          <h1>{currentPage.title}</h1>
        </div>
      </div>

      <div className="header-controls">
        <ThemeToggle />
        <NotificationBell />
        
        <div className="header-user">
          <div className="header-user-copy">
            <span className="header-user-label">Operator</span>
            <strong>{operatorName}</strong>
            <span>{operatorRole}</span>
          </div>

          {isAdmin ? (
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
          ) : null}

          <Button 
            className="header-icon-button" 
            onClick={() => onNavigate("/profile")} 
            size="icon"
            tone="ghost"
            title="Profile"
          >
            <UserIcon />
          </Button>

          <Button 
            className="header-icon-button" 
            onClick={() => void onLogout()} 
            size="icon"
            tone="ghost"
            title="Log out"
          >
            <LogoutIcon />
          </Button>
        </div>
      </div>
    </header>
  );
}
