import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./contexts/AuthProvider";
import { allPages, defaultPath, navigationSections, pagesByPath } from "./config/pageCatalog";
import { useAuth } from "./hooks/useAuth";
import { useHashLocation } from "./hooks/useHashLocation";
import { DashboardPage } from "./pages/DashboardPage";
import { DataPage } from "./pages/DataPage";
import { LoginPage } from "./pages/LoginPage";

function AppContent() {
  const { user, loading, logout } = useAuth();
  const { pathname, navigate } = useHashLocation();
  const currentPage = pagesByPath[pathname] ?? pagesByPath[defaultPath] ?? allPages[0];

  useEffect(() => {
    if (!user && pathname !== "/login") {
      navigate("/login");
    }

    if (user && pathname === "/login") {
      navigate(defaultPath);
    }
  }, [navigate, pathname, user]);

  if (loading) {
    return <div className="loading-screen">Preparing CRM workspace...</div>;
  }

  if (!user) {
    return <LoginPage onSuccess={() => navigate(defaultPath)} />;
  }

  return (
    <AppLayout
      currentPage={currentPage}
      onLogout={async () => {
        await logout();
        navigate("/login");
      }}
      onNavigate={navigate}
      sections={navigationSections}
    >
      {currentPage.kind === "dashboard" ? <DashboardPage /> : <DataPage page={currentPage} />}
    </AppLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
