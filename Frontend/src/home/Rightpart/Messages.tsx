import { useEffect, useRef } from "react";
import MessageView from "./Message";
import useGetMessage from "../../context/useGetMessage";
import Loading from "../../components/Loading";
import useGetSocketMessage from "../../context/useGetSocketMessage";

function Messages() {
  const { loading, messages } = useGetMessage();
  useGetSocketMessage();
  const lastMsgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      lastMsgRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    return () => window.clearTimeout(timer);
  }, [messages]);

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ minHeight: "calc(92vh - 8vh)" }}
    >
      {loading ? (
        <Loading />
      ) : (
        messages.map((message) => (
          <div key={message._id} ref={lastMsgRef}>
            <MessageView message={message} />
          </div>
        ))
      )}

      {!loading && messages.length === 0 && (
        <div>
          <p className="text-center mt-[20%]">Say! Hi to start the conversation</p>
        </div>
      )}
    </div>
  );
}

export default Messages;
