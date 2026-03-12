import React from "react";
import useConversation from "../../statemanage/useConversation.js";
import { useSocketContext } from "../../context/SocketContext.jsx";

function Chatuser() {
  const { selectedConversation } = useConversation();
  const { onlineUsers } = useSocketContext();

  // Guard clause: If no conversation is selected, don't try to render details
  if (!selectedConversation) return <div className="h-[12vh] bg-gray-700"></div>;

  const getOnlineUsersStatus = (userId) => {
    return onlineUsers.includes(userId) ? "Online" : "Offline";
  };

  return (
    <div className="pl-5 pt-2 h-[12vh] flex items-center space-x-4 bg-gray-700 hover:bg-gray-600 duration-300">
      <div>
        <div className={`avatar ${getOnlineUsersStatus(selectedConversation._id) === "Online" ? "online" : ""}`}>
          <div className="w-12 rounded-full bg-gray-500">
            <img 
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E" 
              alt="User Silhouette" 
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center leading-tight">
        <h1 className="text-lg font-bold text-white leading-none">
          {selectedConversation?.username || selectedConversation?.fullname || "Unknown User"}
        </h1>

        <div className="flex items-center space-x-1 mt-1">
          <span className={`h-2 w-2 rounded-full ${getOnlineUsersStatus(selectedConversation?._id) === "Online" ? "bg-green-500" : "bg-gray-500"}`}></span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-300">
            {getOnlineUsersStatus(selectedConversation?._id)}
          </span>
        </div>
      </div>

    </div>
  );
}

export default Chatuser;
