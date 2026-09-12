import { useEffect, useState } from "react";
import axiosClient from "../utils/axiosConfig";
import { useUserStore } from "../state/userStore";
import type { PublicUser } from "../types/api";

export interface UseUsersResult {
  users: PublicUser[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}

export function useUsers(): UseUsersResult {
  const users = useUserStore((state) => state.users);
  const setUsers = useUserStore((state) => state.setUsers);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const loadUsers = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await axiosClient.get<PublicUser[]>(
          "/api/user/allusers",
          { signal: controller.signal }
        );

        if (cancelled) return;

        setUsers(response.data);
        setLoading(false);
      } catch (requestError) {
        if (cancelled || controller.signal.aborted) return;

        console.error("Failed to load users", requestError);
        setLoading(false);
        setError(true);
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [retryKey, setUsers]);

  return {
    users,
    loading,
    error,
    retry: () => setRetryKey((current) => current + 1),
  };
}
