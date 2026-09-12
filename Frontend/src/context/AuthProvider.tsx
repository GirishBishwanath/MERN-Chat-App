import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import axiosClient from "../utils/axiosConfig";
import { isAxiosError } from "axios";
import type { AuthResponse, AuthStatus, PublicUser } from "../types/api";

interface AuthContextValue {
  authUser: PublicUser | null;
  setAuthUser: (user: PublicUser | null) => void;
  authStatus: AuthStatus;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authUser, setAuthUserState] = useState<PublicUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");

  const setAuthUser = useCallback((user: PublicUser | null) => {
    setAuthUserState(user);
    setAuthStatus(user ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const response = await axiosClient.get<AuthResponse>("/api/user/me");
        if (mounted) setAuthUser(response.data.user);
      } catch (error: unknown) {
        if (isAxiosError(error) && error.response?.status === 401) {
          try {
            const refreshResponse = await axiosClient.post<AuthResponse>(
              "/api/user/refresh"
            );
            if (mounted) setAuthUser(refreshResponse.data.user);
            return;
          } catch {
            // The refresh session is missing or expired.
          }
        }

        if (mounted) setAuthUser(null);
      }
    };

    const handleAuthExpired = () => {
      if (mounted) setAuthUser(null);
    };

    window.addEventListener("auth:expired", handleAuthExpired);
    void restoreSession();

    return () => {
      mounted = false;
      window.removeEventListener("auth:expired", handleAuthExpired);
    };
  }, [setAuthUser]);

  const value = useMemo(
    () => ({ authUser, setAuthUser, authStatus }),
    [authUser, setAuthUser, authStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
