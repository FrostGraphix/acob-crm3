import { useEffect, useState, type PropsWithChildren } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import type { AppPageConfig, NavigationSection } from "../../types";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "acob-sidebar-collapsed";

interface AppLayoutProps extends PropsWithChildren {
  currentPage: AppPageConfig;
  sections: NavigationSection[];
  onNavigate: (path: string) => void;
  onLogout: () => Promise<void>;
}

export function AppLayout({
  currentPage,
  sections,
  onNavigate,
  onLogout,
  children,
}: AppLayoutProps) {
  const isDashboardView = currentPage.path === "/dashboard";
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
    <div
      className={`crm-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""} ${
        isDashboardView ? "crm-shell--dashboard" : ""
      }`}
    >
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
        onLogout={onLogout}
        isOpen={isMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
      />
      <div className={`crm-main ${isDashboardView ? "crm-main--dashboard" : ""}`}>
        <Header
          currentPage={currentPage}
          isSidebarCollapsed={isSidebarCollapsed}
          onLogout={onLogout}
          onNavigate={handleNavigate}
          onToggleMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onToggleSidebarCollapse={() => setIsSidebarCollapsed((current) => !current)}
        />
        <div className="crm-workspace">
          <main className={`crm-content ${isDashboardView ? "crm-content--dashboard" : ""}`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
