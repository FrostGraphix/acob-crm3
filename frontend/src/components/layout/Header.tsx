import { useAuth } from "../../hooks/useAuth";
import type { AppPageConfig } from "../../types";

interface HeaderProps {
  currentPage: AppPageConfig;
  onLogout: () => Promise<void>;
}

export function Header({ currentPage, onLogout }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="crm-header">
      <div>
        <p className="eyebrow">Operations Center</p>
        <h1>{currentPage.title}</h1>
        <p className="page-description">{currentPage.description}</p>
      </div>
      <div className="header-user">
        <div className="header-user-copy">
          <strong>{user?.displayName ?? "Operator"}</strong>
          <span>{user?.role ?? "Administrator"}</span>
        </div>
        <button className="button button-ghost" onClick={() => void onLogout()} type="button">
          Log out
        </button>
      </div>
    </header>
  );
}
