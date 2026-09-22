import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Messages from "./Messages";

const { mockRetry, mockedMessagesState, mockUseSocketMessages } = vi.hoisted(
  () => ({
    mockRetry: vi.fn(),
    mockUseSocketMessages: vi.fn(),
    mockedMessagesState: {
      loading: false,
      error: null as string | null,
      messages: [] as Array<{
        _id: string;
        message: string;
      }>,
    },
  })
);

vi.mock("../../hooks/useMessages", () => ({
  useMessages: () => ({
    loading: mockedMessagesState.loading,
    error: mockedMessagesState.error,
    messages: mockedMessagesState.messages,
    retry: mockRetry,
  }),
}));

vi.mock("../../hooks/useSocketMessages", () => ({
  useSocketMessages: mockUseSocketMessages,
}));

vi.mock("./Message", () => ({
  default: ({
    message,
  }: {
    message: {
      _id: string;
      message: string;
    };
  }) => <div data-testid={`message-${message._id}`}>{message.message}</div>,
}));

vi.mock("../../components/Loading", () => ({
  default: () => <div>Loading messages...</div>,
}));

describe("Messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedMessagesState.loading = false;
    mockedMessagesState.error = null;
    mockedMessagesState.messages = [];
  });

  it("renders the loading state while messages are being fetched", () => {
    mockedMessagesState.loading = true;

    render(<Messages />);

    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
    expect(
      screen.queryByText("Say! Hi to start the conversation")
    ).not.toBeInTheDocument();
  });

  it("renders the error state with a retry button", () => {
    mockedMessagesState.error = "Unable to load messages";

    render(<Messages />);

    expect(
      screen.getByText("Unable to load messages.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Retry" })
    ).toBeInTheDocument();
  });

  it("calls retry when the retry button is clicked", async () => {
    const user = userEvent.setup();

    mockedMessagesState.error = "Unable to load messages";

    render(<Messages />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the empty conversation state when there are no messages", () => {
    render(<Messages />);

    expect(
      screen.getByText("Say! Hi to start the conversation")
    ).toBeInTheDocument();
  });

  it("renders all messages returned by the messages hook", () => {
    mockedMessagesState.messages = [
      {
        _id: "message-1",
        message: "Hello",
      },
      {
        _id: "message-2",
        message: "Hi there",
      },
    ];

    render(<Messages />);

    expect(screen.getByTestId("message-message-1")).toHaveTextContent(
      "Hello"
    );

    expect(screen.getByTestId("message-message-2")).toHaveTextContent(
      "Hi there"
    );

    expect(
      screen.queryByText("Say! Hi to start the conversation")
    ).not.toBeInTheDocument();
  });

  it("initializes realtime message handling", () => {
    render(<Messages />);

    expect(mockUseSocketMessages).toHaveBeenCalledTimes(1);
  });

  it("scrolls to the latest message after messages change", async () => {
    mockedMessagesState.messages = [
      {
        _id: "message-1",
        message: "Hello",
      },
    ];

    const scrollIntoView = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(<Messages />);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 150);
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
    });
  });
});