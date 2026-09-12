import { useState, type FormEvent } from "react";
import { IoSend } from "react-icons/io5";
import toast from "react-hot-toast";
import useSendMessage from "../../context/useSendMessage";

function Typesend() {
  const [message, setMessage] = useState("");
  const { sendMessages, loading, error } = useSendMessage();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim() || loading) return;

    const sent = await sendMessages(message);
    if (sent) {
      setMessage("");
    } else if (error) {
      toast.error("Unable to send message");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex space-x-1 h-[8vh] bg-gray-800">
        <div className="w-[70%] mx-4">
          <input
            type="text"
            placeholder="Type here"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={loading}
            className="border-[1px] border-gray-700 flex items-center w-full py-3 px-3 rounded-xl grow outline-none bg-slate-900 mt-1"
          />
        </div>
        <button type="submit" disabled={loading || !message.trim()} aria-label="Send message">
          <IoSend className="text-3xl" />
        </button>
      </div>
    </form>
  );
}

export default Typesend;
