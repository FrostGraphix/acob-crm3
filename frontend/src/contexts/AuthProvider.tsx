import { useEffect, useState, type PropsWithChildren } from "react";
import { getUserInfo, loginRequest, logoutRequest } from "../services/api";
import type { AuthUser } from "../types";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrateUser() {
      try {
        const currentUser = await getUserInfo();

        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void hydrateUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = async () => {
    try {
      const currentUser = await getUserInfo();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  };

  const login = async (credentials: { username: string; password: string }) => {
    const currentUser = await loginRequest(credentials);
    setUser(currentUser);
  };

  const logout = async () => {
    await logoutRequest();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        replaceUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
