import React, { useState } from "react";
import { TbLogout2 } from "react-icons/tb";
import axios from "../../utils/axiosConfig";
import { useAuth } from "../../context/AuthProvider";
import toast from "react-hot-toast";

function Logout() {
  const [loading, setLoading] = useState(false);
  const { setAuthUser } = useAuth();

  const handleLogout = async () => {
    setLoading(true);
    try {
      await axios.post("/api/user/logout");
      setAuthUser(null);
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error(error.response?.data?.error || "Error in logging out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[4%] bg-slate-950 text-white flex flex-col justify-end">
      <div className="p-3 align-bottom">
        <button type="button" onClick={handleLogout} disabled={loading} aria-label="Log out">
          <TbLogout2 className="text-5xl p-2 hover:bg-gray-600 rounded-lg duration-300" />
        </button>
      </div>
    </div>
  );
}

export default Logout;
