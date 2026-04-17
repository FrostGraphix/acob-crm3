import { createContext } from "react";
import type { AuthUser } from "../types";

interface LoginCredentials {
  username: string;
  password: string;
  portal?: "staff" | "vendor";
  upstreamUsername?: string;
  upstreamPassword?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  replaceUser: (user: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
