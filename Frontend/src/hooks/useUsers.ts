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

  const [state, setState] = useState({
    loading: true,
    error: false,
    retryKey: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadUsers = async () => {
      setState((current) => ({ ...current, loading: true, error: false }));

      try {
        const response = await axiosClient.get<PublicUser[]>(
          "/api/user/allusers",
          { signal: controller.signal }
        );
        if (!cancelled) {
          setUsers(response.data);
          setState((current) => ({ ...current, loading: false }));
        }
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          console.error("Failed to load users", error);
          setState((current) => ({ ...current, loading: false, error: true }));
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [setUsers, state.retryKey]);

  return {
    users,
    loading: state.loading,
    error: state.error,
    retry: () =>
      setState((current) => ({ ...current, retryKey: current.retryKey + 1 })),
  };
}
