import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./contexts/AuthProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import { allPages, defaultPath, navigationSections, pagesByPath } from "./config/pageCatalog";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/LoginPage";
import type { AppPageConfig } from "./types";

const DashboardPage = lazy(async () => {
  const module = await import("./pages/DashboardPage");
  return { default: module.DashboardPage };
});

const DataPage = lazy(async () => {
  const module = await import("./pages/DataPage");
  return { default: module.DataPage };
});

const ReportsPage = lazy(async () => {
  const module = await import("./pages/ReportsPage");
  return { default: module.ReportsPage };
});

const ProfilePage = lazy(async () => {
  const module = await import("./pages/ProfilePage");
  return { default: module.ProfilePage };
});

function resolveCurrentPage(pathname: string) {
  return pagesByPath[pathname] ?? pagesByPath[defaultPath] ?? allPages[0];
}

function ensureCurrentTabVisible(tabs: AppPageConfig[], currentPage: AppPageConfig) {
  if (tabs.some((tab) => tab.path === currentPage.path)) {
    return tabs;
  }

  return [...tabs, currentPage];
}

function renderPage(page: AppPageConfig) {
  return (
    <Suspense fallback={<div className="loading-screen" style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading page...</div>}>
      {page.kind === "dashboard" ? <DashboardPage /> : null}
      {page.kind === "data" && page.sectionKey === "data-report" ? <ReportsPage /> : null}
      {page.kind === "data" && page.sectionKey !== "data-report" ? <DataPage page={page} /> : null}
      {page.kind === "profile" ? <ProfilePage /> : null}
    </Suspense>
  );
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const currentPage = resolveCurrentPage(pathname);

  const [openedTabs, setOpenedTabs] = useState<AppPageConfig[]>([pagesByPath[defaultPath]]);
  const visibleTabs = ensureCurrentTabVisible(openedTabs, currentPage);

  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== "/login") {
      navigate("/login", { replace: true });
      return;
    }

    if (user && pathname === "/login") {
      navigate(defaultPath, { replace: true });
    }
  }, [loading, navigate, pathname, user]);

  useEffect(() => {
    if (loading || !user || pathname === "/login") return;

    const page = pagesByPath[pathname];
    if (page) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenedTabs((prev: AppPageConfig[]) => {
        if (!prev.find((t: AppPageConfig) => t.path === page.path)) {
          return [...prev, page];
        }
        return prev;
      });
    }
  }, [pathname, loading, user]);

  const handleCloseTab = (path: string) => {
    setOpenedTabs((prev: AppPageConfig[]) => {
      const filtered = prev.filter((t: AppPageConfig) => t.path !== path);
      if (path === pathname) {
        const nextPath = filtered.length > 0 ? filtered[filtered.length - 1].path : defaultPath;
        navigate(nextPath);
      }
      return filtered.length > 0 ? filtered : [pagesByPath[defaultPath]];
    });
  };

  if (loading) {
    return <div className="loading-screen">Preparing CRM workspace...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route
          path="/login"
          element={<LoginPage onSuccess={() => navigate(defaultPath, { replace: true })} />}
        />
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    );
  }

  return (
    <AppLayout
      currentPage={currentPage}
      onLogout={async () => {
        await logout();
        navigate("/login", { replace: true });
      }}
      onNavigate={(path) => navigate(path)}
      sections={navigationSections}
      tabs={visibleTabs}
      onCloseTab={handleCloseTab}
    >
      <Routes>
        <Route path="/" element={<Navigate replace to={defaultPath} />} />
        <Route path="/login" element={<Navigate replace to={defaultPath} />} />
      </Routes>
      
      {user && pathname !== "/login" && (
        <>
          {visibleTabs.map((tab: AppPageConfig) => (
            <div
              key={tab.path}
              style={{
                display: tab.path === pathname ? "block" : "none",
                height: "100%",
                flex: "1 1 auto",
                overflow: "hidden"
              }}
            >
              {renderPage(tab)}
            </div>
          ))}
        </>
      )}
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
