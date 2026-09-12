import { useEffect, useState } from "react";
import axios from "../utils/axiosConfig";
import type { PublicUser } from "../types/api";

interface UseGetAllUsersResult {
  allUsers: PublicUser[];
  loading: boolean;
}

const useGetAllUsers = (): UseGetAllUsersResult => {
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const getUsers = async () => {
      setLoading(true);
      try {
        const response = await axios.get<PublicUser[]>("/api/user/allusers");
        if (mounted) setAllUsers(response.data);
      } catch (error) {
        if (mounted) console.error("Error in useGetAllUsers:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void getUsers();
    return () => {
      mounted = false;
    };
  }, []);

  return { allUsers, loading };
};

export default useGetAllUsers;
