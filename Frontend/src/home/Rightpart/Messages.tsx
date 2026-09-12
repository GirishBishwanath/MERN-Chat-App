import { useEffect, useRef } from "react";
import MessageView from "./Message";
import { useMessages } from "../../hooks/useMessages";
import Loading from "../../components/Loading";
import useGetSocketMessage from "../../context/useGetSocketMessage";

function Messages() {
  const { loading, error, messages, retry } = useMessages();
  useGetSocketMessage();
  const lastMsgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      lastMsgRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [messages]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-center text-slate-300">
        <div>
          <p>Unable to load messages.</p>
          <button type="button" className="btn btn-sm mt-3" onClick={retry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ minHeight: "calc(92vh - 8vh)" }}
      aria-live="polite"
    >
      {messages.map((message) => (
        <div key={message._id} ref={lastMsgRef}>
          <MessageView message={message} />
        </div>
      ))}

      {messages.length === 0 && (
        <div>
          <p className="text-center mt-[20%]">Say! Hi to start the conversation</p>
        </div>
      )}
    </div>
  );
}

export default Messages;
