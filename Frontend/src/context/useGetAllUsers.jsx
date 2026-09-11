import React, { useEffect, useState } from "react";
import axios from "../utils/axiosConfig";

function useGetAllUsers() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const getUsers = async () => {
      setLoading(true);
      try {
        const response = await axios.get("/api/user/allusers");
        if (mounted) setAllUsers(response.data);
      } catch (error) {
        console.error("Error in useGetAllUsers:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    getUsers();
    return () => {
      mounted = false;
    };
  }, []);

  return [allUsers, loading];
}

export default useGetAllUsers;
