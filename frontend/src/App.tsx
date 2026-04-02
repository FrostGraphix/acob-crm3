import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { SkeletonTable } from "./components/common/LoadingSkeleton";
import { AuthProvider } from "./contexts/AuthProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import { allPages, defaultPath, navigationSections, pagesByPath } from "./config/pageCatalog";
import { useAuth } from "./hooks/useAuth";
import {
  closeTabAndResolveNextPath,
  ensureCurrentTabVisible,
  filterNavigationSectionsForUser,
  filterPagesForUser,
  resolveAccessiblePage,
  syncOpenedTabsWithUserAccess,
} from "./services/app-shell-state";
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

const SiteConsumptionPage = lazy(async () => {
  const module = await import("./pages/SiteConsumptionPage");
  return { default: module.SiteConsumptionPage };
});

const ProfilePage = lazy(async () => {
  const module = await import("./pages/ProfilePage");
  return { default: module.ProfilePage };
});
const RuntimeAdminPage = lazy(async () => {
  const module = await import("./pages/RuntimeAdminPage");
  return { default: module.RuntimeAdminPage };
});

function LoadingFallback() {
  return (
    <div style={{ padding: "2rem" }}>
      <SkeletonTable rows={6} columns={5} />
    </div>
  );
}

function renderPage(page: AppPageConfig) {
  return (
    <ErrorBoundary fallbackTitle={`Error loading ${page.title}`}>
      <Suspense fallback={<LoadingFallback />}>
        {page.kind === "dashboard" ? <DashboardPage /> : null}
        {page.kind === "data" && page.sectionKey === "data-report" ? <ReportsPage /> : null}
        {page.kind === "data" && page.sectionKey !== "data-report" ? <DataPage page={page} /> : null}
        {page.kind === "site-consumption" ? <SiteConsumptionPage /> : null}
        {page.kind === "profile" ? <ProfilePage /> : null}
        {page.kind === "runtime-admin" ? <RuntimeAdminPage /> : null}
      </Suspense>
    </ErrorBoundary>
  );
}

function AppRoutes({ pages }: { pages: AppPageConfig[] }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={defaultPath} />} />
      <Route path="/login" element={<Navigate replace to={defaultPath} />} />
      {pages.map((page) => (
        <Route key={page.path} path={page.path} element={renderPage(page)} />
      ))}
      <Route path="*" element={<Navigate replace to={defaultPath} />} />
    </Routes>
  );
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const accessiblePages = filterPagesForUser(allPages, user);
  const fallbackPage = accessiblePages.find((page) => page.path === defaultPath) ?? accessiblePages[0] ?? allPages[0];
  const currentPage = resolveAccessiblePage(pathname, pagesByPath, fallbackPage, user);
  const accessibleSections = filterNavigationSectionsForUser(navigationSections, user);

  const [openedTabs, setOpenedTabs] = useState<AppPageConfig[]>([pagesByPath[defaultPath]]);
  const visibleTabs =
    pathname === "/login" ? openedTabs : ensureCurrentTabVisible(openedTabs, currentPage);

  useEffect(() => {
    if (loading) return;

    if (!user && pathname !== "/login") {
      navigate("/login", { replace: true });
      return;
    }

    if (user && !accessiblePages.some((page) => page.path === pathname) && pathname !== "/login") {
      navigate(fallbackPage.path, { replace: true });
      return;
    }

    if (user && pathname === "/login") {
      navigate(defaultPath, { replace: true });
    }
  }, [accessiblePages, fallbackPage.path, loading, navigate, pathname, user]);

  useEffect(() => {
    if (loading || !user || pathname === "/login") return;

    const page = accessiblePages.find((entry) => entry.path === pathname);
    if (page) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenedTabs((prev: AppPageConfig[]) => {
        if (!prev.find((t: AppPageConfig) => t.path === page.path)) {
          return [...prev, page];
        }
        return prev;
      });
    }
  }, [accessiblePages, pathname, loading, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setOpenedTabs((prev) => syncOpenedTabsWithUserAccess(prev, accessiblePages, fallbackPage));
  }, [accessiblePages, fallbackPage, user]);

  const handleCloseTab = (path: string) => {
    setOpenedTabs((prev: AppPageConfig[]) => {
      const { nextTabs, nextPath } = closeTabAndResolveNextPath(prev, path, pathname, defaultPath);
      if (nextPath !== pathname) {
        navigate(nextPath);
      }
      return nextTabs;
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
      sections={accessibleSections}
      tabs={visibleTabs}
      onCloseTab={handleCloseTab}
    >
      <AppRoutes pages={accessiblePages} />
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
