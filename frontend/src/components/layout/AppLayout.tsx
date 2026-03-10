import type { PropsWithChildren } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import type { AppPageConfig, NavigationSection } from "../../types";

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
  return (
    <div className="crm-shell">
      <Sidebar
        currentPath={currentPage.path}
        sections={sections}
        onNavigate={onNavigate}
      />
      <div className="crm-main">
        <Header currentPage={currentPage} onLogout={onLogout} />
        <main className="crm-content">{children}</main>
      </div>
    </div>
  );
}
