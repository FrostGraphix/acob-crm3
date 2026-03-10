import { createContext } from "react";
import type { AuthUser } from "../types";

interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
