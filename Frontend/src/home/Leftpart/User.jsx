import React from "react";
import useConversation from "../../statemanage/useConversation.js";
import { useSocketContext } from "../../context/SocketContext.jsx";

function User({ user }) {
  const { selectedConversation, setSelectedConversation } = useConversation();
  const isSelected = selectedConversation?._id === user._id;
  const { onlineUsers } = useSocketContext();
  const isOnline = onlineUsers.includes(user._id);

  return (
    <div
      className={`duration-300 cursor-pointer ${
        isSelected ? "bg-slate-700" : "hover:bg-slate-600"
      }`}
      onClick={() => setSelectedConversation(user)}
    >
      <div className="flex items-center space-x-4 px-4 py-3 border-b border-slate-700/50">
        <div className={`avatar ${isOnline ? "online" : ""}`}>
          <div className="w-12 rounded-full bg-slate-500">
            <img 
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E" 
              alt="User Silhouette" 
            />        
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-white truncate">
            {user.username || user.fullname || user.name}
          </h1>
          <p className="text-sm text-slate-400 truncate">
            {user.email}
          </p>
        </div>
      </div>
    </div>
  );
}

export default User;
