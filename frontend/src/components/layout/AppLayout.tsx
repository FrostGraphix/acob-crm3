import { useEffect, useState, type PropsWithChildren } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import type { AppPageConfig, NavigationSection } from "../../types";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "acob-sidebar-collapsed";

interface AppLayoutProps extends PropsWithChildren {
  currentPage: AppPageConfig;
  sections: NavigationSection[];
  onNavigate: (path: string) => void;
  onLogout: () => Promise<void>;
  tabs?: AppPageConfig[];
  onCloseTab?: (path: string) => void;
}

export function AppLayout({
  currentPage,
  sections,
  onNavigate,
  onLogout,
  tabs,
  onCloseTab,
  children,
}: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  const handleNavigate = (path: string) => {
    onNavigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`crm-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Sidebar Backdrop for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="modal-backdrop" 
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ zIndex: 999 }}
        />
      )}
      
      <Sidebar
        key={`sidebar-${currentPage.sectionKey}`}
        currentPath={currentPage.path}
        sections={sections}
        onNavigate={handleNavigate}
        isOpen={isMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
      />
      <div className="crm-main">
        <Header
          currentPage={currentPage}
          isSidebarCollapsed={isSidebarCollapsed}
          onLogout={onLogout}
          onNavigate={handleNavigate}
          onToggleMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onToggleSidebarCollapse={() => setIsSidebarCollapsed((current) => !current)}
        />
        {tabs && onCloseTab ? (
          <TabBar tabs={tabs} activePath={currentPage.path} onClose={onCloseTab} />
        ) : null}
        <main className="crm-content">{children}</main>
      </div>
    </div>
  );
}
