import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "../utils/axiosConfig";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUserState] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");

  const setAuthUser = (user) => {
    setAuthUserState(user);
    setAuthStatus(user ? "authenticated" : "unauthenticated");
  };

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const response = await axios.get("/api/user/me");
        if (mounted) {
          setAuthUserState(response.data.user);
          setAuthStatus("authenticated");
        }
      } catch (error) {
        if (error.response?.status === 401) {
          try {
            const refreshResponse = await axios.post("/api/user/refresh");
            if (mounted) {
              setAuthUserState(refreshResponse.data.user);
              setAuthStatus("authenticated");
            }
            return;
          } catch {
            // The refresh session is missing or expired.
          }
        }

        if (mounted) {
          setAuthUserState(null);
          setAuthStatus("unauthenticated");
        }
      }
    };

    const handleAuthExpired = () => {
      if (mounted) {
        setAuthUserState(null);
        setAuthStatus("unauthenticated");
      }
    };

    window.addEventListener("auth:expired", handleAuthExpired);
    restoreSession();

    return () => {
      mounted = false;
      window.removeEventListener("auth:expired", handleAuthExpired);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, setAuthUser, authStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
