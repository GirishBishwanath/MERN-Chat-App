import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "../utils/axiosConfig";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const response = await axios.get("/api/user/me");
        if (mounted) {
          setAuthUser(response.data.user);
          setAuthStatus("authenticated");
        }
      } catch (error) {
        if (error.response?.status === 401) {
          try {
            const refreshResponse = await axios.post("/api/user/refresh");
            if (mounted) {
              setAuthUser(refreshResponse.data.user);
              setAuthStatus("authenticated");
            }
            return;
          } catch {
            // A missing or expired refresh session means the user is signed out.
          }
        }

        if (mounted) {
          setAuthUser(null);
          setAuthStatus("unauthenticated");
        }
      }
    };

    const handleAuthExpired = () => {
      if (mounted) {
        setAuthUser(null);
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
