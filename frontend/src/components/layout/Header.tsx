import { useAuth } from "../../hooks/useAuth";
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
  onLogout,
  onNavigate,
  onToggleMenu,
  onToggleSidebarCollapse,
}: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="crm-header">
      <div className="header-primary">
        <button
          className="button-icon-only desktop-sidebar-toggle"
          onClick={onToggleSidebarCollapse}
          type="button"
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="20" height="20">
            {isSidebarCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
        <button
          className="button-icon-only mobile-menu-toggle"
          onClick={onToggleMenu}
          type="button"
          aria-label="Toggle menu"
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="24" height="24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="header-copy">
          <p className="eyebrow">Operations Center</p>
          <h1>{currentPage.title}</h1>
          <p className="page-description">{currentPage.description}</p>
        </div>
      </div>
      <div className="header-controls">
        <ThemeToggle />
        <NotificationBell />
        <div className="header-user">
          <button className="button button-ghost" onClick={() => onNavigate("/profile")} type="button">
            Profile
          </button>
          <div className="header-user-copy">
            <strong>{user?.displayName ?? "Operator"}</strong>
            <span>{user?.role ?? "Administrator"}</span>
          </div>
          <button className="button button-ghost" onClick={() => void onLogout()} type="button">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
