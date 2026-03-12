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
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="18" height="18">
            {isSidebarCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
        
        <button
          className="button-icon-only mobile-menu-toggle"
          style={{ display: 'none' }}
          onClick={onToggleMenu}
          type="button"
        >
          <MenuIcon />
        </button>

        <div className="header-copy">
          <h1>{currentPage.title}</h1>
        </div>
      </div>

      <div className="header-controls">
        <ThemeToggle />
        <NotificationBell />
        
        <div className="header-user">
          <div className="header-user-copy">
            <strong>{user?.displayName ?? "Operator"}</strong>
            <span>{user?.role ?? "Administrator"}</span>
          </div>

          <button 
            className="header-icon-button" 
            onClick={() => onNavigate("/profile")} 
            title="Profile"
            type="button"
          >
            <UserIcon />
          </button>

          <button 
            className="header-icon-button" 
            onClick={() => void onLogout()} 
            title="Log out"
            type="button"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
