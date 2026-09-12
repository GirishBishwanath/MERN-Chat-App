import { useState } from "react";
import { TbLogout2 } from "react-icons/tb";
import axiosClient from "../../utils/axiosConfig";
import { isAxiosError } from "axios";
import { useAuth } from "../../context/AuthProvider";
import toast from "react-hot-toast";
import type { ApiErrorResponse } from "../../types/api";

function Logout() {
  const [loading, setLoading] = useState(false);
  const { setAuthUser } = useAuth();

  const handleLogout = async (): Promise<void> => {
    setLoading(true);
    try {
      await axiosClient.post("/api/user/logout");
      setAuthUser(null);
      toast.success("Logged out successfully");
    } catch (error: unknown) {
      const message = isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data?.error
        : undefined;
      toast.error(message || "Error in logging out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[4%] bg-slate-950 text-white flex flex-col justify-end">
      <div className="p-3 align-bottom">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          aria-label="Log out"
        >
          <TbLogout2 className="text-5xl p-2 hover:bg-gray-600 rounded-lg duration-300" />
        </button>
      </div>
    </div>
  );
}

export default Logout;
