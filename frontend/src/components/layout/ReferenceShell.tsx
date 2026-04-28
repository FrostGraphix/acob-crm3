import { useEffect, useState, type PropsWithChildren } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import type { AppPageConfig, NavigationSection } from "../../types";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "acob-sidebar-collapsed";

interface ReferenceShellProps extends PropsWithChildren {
  currentPage: AppPageConfig;
  sections: NavigationSection[];
  onNavigate: (path: string) => void;
  onLogout: () => Promise<void>;
}

export function ReferenceShell({
  currentPage,
  sections,
  onNavigate,
  onLogout,
  children,
}: ReferenceShellProps) {
  const isReferenceTokenPage =
    currentPage.path.startsWith("/token-generate/") || currentPage.path.startsWith("/token-record/");
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

    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const handleNavigate = (path: string) => {
    onNavigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <div
      className={`reference-shell ${isSidebarCollapsed ? "reference-shell--collapsed" : ""} ${
        isReferenceTokenPage ? "reference-shell--token" : ""
      }`}
    >
      <div className="reference-shell__backdrop">
        <span className="reference-shell__glow reference-shell__glow--left" />
        <span className="reference-shell__glow reference-shell__glow--right" />
      </div>

      {isMobileMenuOpen ? (
        <button
          aria-label="Close navigation"
          className="reference-shell__mobile-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          type="button"
        />
      ) : null}

      <Sidebar
        currentPath={currentPage.path}
        isCollapsed={isSidebarCollapsed}
        isOpen={isMobileMenuOpen}
        onLogout={onLogout}
        onNavigate={handleNavigate}
        sections={sections}
      />

      <div className="reference-shell__main">
        <Header
          currentPage={currentPage}
          isSidebarCollapsed={isSidebarCollapsed}
          onNavigate={handleNavigate}
          onToggleSidebarCollapse={() => setIsSidebarCollapsed((current) => !current)}
        />

        <div className="reference-shell__workspace">
          <main
            className={`reference-shell__content ${
              isReferenceTokenPage ? "reference-shell__content--token" : ""
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default ReferenceShell;
