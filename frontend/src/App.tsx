import { lazy, Suspense, useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ReferenceShell } from "./components/layout/ReferenceShell";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { SkeletonTable } from "./components/common/LoadingSkeleton";
import { AuthProvider } from "./contexts/AuthProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import { allPages, defaultPath, navigationSections, pagesByPath } from "./config/pageCatalog";
import { useAuth } from "./hooks/useAuth";
import {
  filterNavigationSectionsForUser,
  filterPagesForUser,
  isVendorWorkspaceUser,
  resolveAccessiblePage,
} from "./services/app-shell-state";
import { LoginPage } from "./pages/LoginPage";
import { VendorLoginPage } from "./pages/VendorLoginPage";
import { VendorChangePasswordPage } from "./pages/VendorChangePasswordPage";
import { loadLazyPage } from "./services/lazy-page";
import type { AppPageConfig, AppWorkspace, NavigationSection } from "./types";

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
const TokenGeneratePage = lazy(() =>
  loadLazyPage("TokenGeneratePage", () => import("./pages/TokenGeneratePage"), "TokenGeneratePage"),
);
const ReferenceMirrorPage = lazy(() =>
  loadLazyPage(
    "ReferenceMirrorPage",
    () => import("./pages/ReferenceMirrorPage"),
    "ReferenceMirrorPage",
  ),
);
const TokenRecordPage = lazy(() =>
  loadLazyPage("TokenRecordPage", () => import("./pages/TokenRecordPage"), "TokenRecordPage"),
);
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
const DocumentsPage = lazy(() =>
  loadLazyPage("DocumentsPage", () => import("./pages/DocumentsPage"), "DocumentsPage"),
);

const VendorPage = lazy(() =>
  loadLazyPage("VendorPage", () => import("./pages/VendorPage"), "VendorPage"),
);
const WalletAdminHomePage = lazy(() =>
  loadLazyPage(
    "WalletAdminHomePage",
    () => import("./pages/WalletAdminHomePage"),
    "WalletAdminHomePage",
  ),
);
const WalletAdminVendorOnboardingPage = lazy(() =>
  loadLazyPage(
    "WalletAdminVendorOnboardingPage",
    () => import("./pages/WalletAdminVendorOnboardingPage"),
    "WalletAdminVendorOnboardingPage",
  ),
);

const reportSectionKeys = new Set(["prepay-report", "remote-report", "data-report", "load-profile"]);
const remoteSectionKeys = new Set([
  "remote-operation",
  "remote-operation-gprs",
  "remote-operation-task",
  "remote-operation-task-gprs",
]);

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
        {page.path === "/token-generate/credit-token" ? (
          <ReferenceMirrorPage pageTitle="Credit Token" referenceHash="#/token-generate/credit-token" />
        ) : null}
        {page.path === "/token-record/credit-token-record" ? (
          <ReferenceMirrorPage
            pageTitle="Credit Token Record"
            referenceHash="#/token-record/credit-token-record"
          />
        ) : null}
        {page.kind === "data" && page.path === "/wallet-admin/vendor-onboarding" ? (
          <WalletAdminVendorOnboardingPage page={page} />
        ) : null}
        {page.kind === "dashboard" && page.path !== "/management/analytics" ? (
          <DashboardPage />
        ) : null}
        {page.kind === "data" && reportSectionKeys.has(page.sectionKey) ? (
          <ReportsPage />
        ) : null}
        {page.kind === "data" &&
        page.sectionKey === "token-generate" &&
        page.path !== "/token-generate/credit-token" ? (
          <TokenGeneratePage page={page} />
        ) : null}
        {page.kind === "data" &&
        page.sectionKey === "token-record" &&
        page.path !== "/token-record/credit-token-record" ? (
          <TokenRecordPage page={page} />
        ) : null}
        {page.kind === "data" && remoteSectionKeys.has(page.sectionKey) ? <RemoteOperationPage page={page} /> : null}
        {page.kind === "data" &&
        page.path !== "/wallet-admin/vendor-onboarding" &&
        page.sectionKey !== "token-generate" &&
        page.sectionKey !== "token-record" &&
        !reportSectionKeys.has(page.sectionKey) &&
        !remoteSectionKeys.has(page.sectionKey) ? (
          <DataPage page={page} />
        ) : null}
        {page.kind === "profile" && page.path !== "/design-system" ? <ProfilePage /> : null}
        {page.kind === "runtime-admin" ? <RuntimeAdminPage /> : null}
        {page.kind === "documents" ? <DocumentsPage /> : null}

        {page.kind === "vendor" ? <VendorPage page={page} /> : null}
        {page.kind === "wallet-admin-home" ? <WalletAdminHomePage page={page} /> : null}
      </Suspense>
    </ErrorBoundary>
  );
}

function pageWorkspaceOf(page: AppPageConfig): AppWorkspace {
  return page.workspace ?? "operations";
}

function buildWorkspaceSections(
  sections: NavigationSection[],
  currentWorkspace: AppWorkspace,
): NavigationSection[] {
  const accessibleWalletLauncher =
    sections
      .flatMap((section) => section.items)
      .find((page) => page.path === "/wallet-admin/overview") ?? null;
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((page) => pageWorkspaceOf(page) === currentWorkspace),
    }))
    .filter((section) => section.items.length > 0);

  if (currentWorkspace !== "operations") {
    return filteredSections;
  }

  if (!accessibleWalletLauncher) {
    return filteredSections;
  }

  return [
    ...filteredSections,
    {
      key: "wallet-admin-launcher",
      label: "Vending Wallet",
      iconKey: "wallet",
      items: [accessibleWalletLauncher],
    },
  ];
}

function AppRoutes({ pages }: { pages: AppPageConfig[] }) {
  const routeDefinitions = pages.flatMap((page) =>
    [page.path, ...(page.aliasPaths ?? [])].map((path) => ({
      path,
      page,
      key: `${page.path}::${path}`,
    })),
  );

  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={defaultPath} />} />
      <Route path="/login" element={<Navigate replace to={defaultPath} />} />
      <Route path="/management" element={<Navigate replace to="/management/meter" />} />
      <Route path="/site-consumption" element={<Navigate replace to="/data-report/site-consumption" />} />
      {routeDefinitions.map(({ key, path, page }) => (
        <Route key={key} path={path} element={renderPage(page)} />
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

  // If authenticated, vendor workspace users must sit in the vendor shell —
  // they cannot enter the CRM shell at all.
  const isVendor = isVendorWorkspaceUser(user);

  const accessiblePages = useMemo(() => filterPagesForUser(allPages, user), [user]);
  const fallbackPage = useMemo(
    () => accessiblePages.find((page) => page.path === defaultPath) ?? accessiblePages[0] ?? allPages[0],
    [accessiblePages],
  );
  const currentPage = useMemo(
    () => resolveAccessiblePage(pathname, pagesByPath, fallbackPage, user),
    [pathname, fallbackPage, user],
  );
  const currentWorkspace = pageWorkspaceOf(currentPage);
  const accessibleSections = useMemo(() => {
    const userSections = filterNavigationSectionsForUser(navigationSections, user);
    return buildWorkspaceSections(userSections, currentWorkspace);
  }, [currentWorkspace, user]);
  const useReferenceStandaloneShell =
    currentPage.path === "/token-generate/credit-token" ||
    currentPage.path === "/token-record/credit-token-record";

  useEffect(() => {
    if (loading) return;

    // Unauthenticated users → staff login
    if (!user && pathname !== "/login") {
      navigate("/login", { replace: true });
      return;
    }

    // Vendor workspace users → redirect to their own shell
    if (user && isVendor && !pathname.startsWith("/vendor/")) {
      navigate("/vendor/dashboard", { replace: true });
      return;
    }

    // Staff trying to access vendor shell paths → redirect to CRM dashboard
    if (user && !isVendor && pathname.startsWith("/vendor/")) {
      navigate(defaultPath, { replace: true });
      return;
    }

    if (user && !isVendor && !accessiblePages.some((page) => page.path === pathname) && pathname !== "/login") {
      navigate(fallbackPage.path, { replace: true });
      return;
    }

    if (user && pathname === "/login") {
      navigate(defaultPath, { replace: true });
    }
  }, [accessiblePages, fallbackPage.path, loading, navigate, pathname, user, isVendor]);

  // Tabs state removed

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

  // Vendor users never see the CRM AppLayout, but they still need their routed pages rendered.
  if (isVendor) {
    return <AppRoutes pages={accessiblePages} />;
  }

  if (useReferenceStandaloneShell) {
    return <AppRoutes pages={accessiblePages} />;
  }

  return (
    <ReferenceShell
      currentPage={currentPage}
      onLogout={async () => {
        await logout();
        navigate("/login", { replace: true });
      }}
      onNavigate={(path) => navigate(path)}
      sections={accessibleSections}
    >
      <AppRoutes pages={accessiblePages} />
    </ReferenceShell>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Public routes served outside the auth-gated AppContent tree */}
        <PublicShellRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Manages the top-level routing split:
 * - /vendor/login and /vendor/change-password are always public (no auth required)
 * - Everything else is handled by AppContent which applies auth guards
 */
function PublicShellRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const isVendorPath = pathname.startsWith("/vendor/");

  if (loading) {
    return <div className="loading-screen">Preparing CRM workspace...</div>;
  }

  // These paths are served without any auth wrapper
  if (pathname === "/vendor/login") {
    if (!user) {
      return <VendorLoginPage />;
    }

    if (user.forcePasswordChange && isVendorWorkspaceUser(user)) {
      return <Navigate replace to="/vendor/change-password" />;
    }

    return <Navigate replace to={isVendorWorkspaceUser(user) ? "/vendor/dashboard" : defaultPath} />;
  }

  if (pathname === "/vendor/change-password") {
    if (!user) {
      return <Navigate replace to="/vendor/login" />;
    }

    if (!isVendorWorkspaceUser(user)) {
      return <Navigate replace to={defaultPath} />;
    }

    return <VendorChangePasswordPage />;
  }

  if (isVendorPath) {
    if (!user) {
      return <Navigate replace to="/vendor/login" />;
    }

    if (!isVendorWorkspaceUser(user)) {
      return <Navigate replace to={defaultPath} />;
    }

    if (user.forcePasswordChange) {
      return <Navigate replace to="/vendor/change-password" />;
    }
  }

  return <AppContent />;
}

export default App;
