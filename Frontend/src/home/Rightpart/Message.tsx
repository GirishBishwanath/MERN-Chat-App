import { useAuth } from "../../context/AuthProvider";
import type { Message as MessageModel } from "../../types/api";

interface MessageProps {
  message: MessageModel;
}

function Message({ message }: MessageProps) {
  const { authUser } = useAuth();
  const itsMe = message.senderId === authUser?._id;
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="p-4">
      <div className={`chat ${itsMe ? "chat-end" : "chat-start"}`}>
        <div className={`chat-bubble text-white ${itsMe ? "bg-blue-500" : ""}`}>
          {message.message}
        </div>
        <div className="chat-footer">{formattedTime}</div>
      </div>
    </div>
  );
}

export default Message;
