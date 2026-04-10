import { lazy, Suspense, useEffect, useMemo, useState } from "react";
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
import { loadLazyPage } from "./services/lazy-page";
import type { AppPageConfig } from "./types";

const DashboardPage = lazy(() =>
  loadLazyPage("DashboardPage", () => import("./pages/DashboardPage"), "DashboardPage"),
);
const ManagementAnalyticsPage = lazy(() =>
  loadLazyPage(
    "ManagementAnalyticsPage",
    () => import("./pages/ManagementAnalyticsPage"),
    "ManagementAnalyticsPage",
  ),
);

const DataPage = lazy(() => loadLazyPage("DataPage", () => import("./pages/DataPage"), "DataPage"));
const RemoteOperationPage = lazy(() =>
  loadLazyPage(
    "RemoteOperationPage",
    () => import("./pages/RemoteOperationPage"),
    "RemoteOperationPage",
  ),
);

const ReportsPage = lazy(() =>
  loadLazyPage("ReportsPage", () => import("./pages/ReportsPage"), "ReportsPage"),
);
const DesignSystemPage = lazy(() =>
  loadLazyPage("DesignSystemPage", () => import("./pages/DesignSystemPage"), "DesignSystemPage"),
);

const ProfilePage = lazy(() =>
  loadLazyPage("ProfilePage", () => import("./pages/ProfilePage"), "ProfilePage"),
);
const RuntimeAdminPage = lazy(() =>
  loadLazyPage("RuntimeAdminPage", () => import("./pages/RuntimeAdminPage"), "RuntimeAdminPage"),
);

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
        {page.path === "/management/analytics" ? <ManagementAnalyticsPage /> : null}
        {page.path === "/design-system" ? <DesignSystemPage /> : null}
        {page.kind === "dashboard" && page.path !== "/management/analytics" ? <DashboardPage /> : null}
        {page.kind === "data" && (page.sectionKey === "data-report" || page.sectionKey === "load-profile") ? (
          <ReportsPage />
        ) : null}
        {page.kind === "data" && page.sectionKey === "remote-operation" ? <RemoteOperationPage page={page} /> : null}
        {page.kind === "data" &&
        page.sectionKey !== "data-report" &&
        page.sectionKey !== "load-profile" &&
        page.sectionKey !== "remote-operation" ? (
          <DataPage page={page} />
        ) : null}
        {page.kind === "profile" && page.path !== "/design-system" ? <ProfilePage /> : null}
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
      <Route path="/management" element={<Navigate replace to="/management/analytics" />} />
      <Route path="/site-consumption" element={<Navigate replace to="/data-report/site-consumption" />} />
      {pages.map((page) => (
        <Route key={page.path} path={page.path} element={renderPage(page)} />
      ))}
      <Route path="*" element={<Navigate replace to={defaultPath} />} />
    </Routes>
  );
}

function sameTabPaths(left: AppPageConfig[], right: AppPageConfig[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.path !== right[index]?.path) {
      return false;
    }
  }

  return true;
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const accessiblePages = useMemo(() => filterPagesForUser(allPages, user), [user]);
  const fallbackPage = useMemo(
    () => accessiblePages.find((page) => page.path === defaultPath) ?? accessiblePages[0] ?? allPages[0],
    [accessiblePages],
  );
  const currentPage = useMemo(
    () => resolveAccessiblePage(pathname, pagesByPath, fallbackPage, user),
    [pathname, fallbackPage, user],
  );
  const accessibleSections = useMemo(
    () => filterNavigationSectionsForUser(navigationSections, user),
    [user],
  );

  const [openedTabs, setOpenedTabs] = useState<AppPageConfig[]>([pagesByPath[defaultPath]]);
  const visibleTabs = useMemo(
    () => (pathname === "/login" ? openedTabs : ensureCurrentTabVisible(openedTabs, currentPage)),
    [pathname, openedTabs, currentPage],
  );

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
        const nextTabs = prev.find((t: AppPageConfig) => t.path === page.path)
          ? prev
          : [...prev, page];
        if (sameTabPaths(prev, nextTabs)) {
          return prev;
        }
        return nextTabs;
      });
    }
  }, [accessiblePages, pathname, loading, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setOpenedTabs((prev) => {
      const nextTabs = syncOpenedTabsWithUserAccess(prev, accessiblePages, fallbackPage);
      if (sameTabPaths(prev, nextTabs)) {
        return prev;
      }
      return nextTabs;
    });
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
