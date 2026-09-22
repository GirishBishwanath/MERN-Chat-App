import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Typesend from "./Typesend";

const { mockSendMessage, mockToastError, mockedState } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
  mockToastError: vi.fn(),
  mockedState: {
    loading: false,
  },
}));

vi.mock("../../hooks/useSendMessage", () => ({
  useSendMessage: () => ({
    sendMessage: mockSendMessage,
    loading: mockedState.loading,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: mockToastError,
  },
}));

describe("Typesend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedState.loading = false;
    mockSendMessage.mockResolvedValue(true);
  });

  it("renders the message input and send button", () => {
    render(<Typesend />);

    expect(
      screen.getByPlaceholderText("Type here")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Send message" })
    ).toBeInTheDocument();
  });

  it("keeps the send button disabled when the message is empty", () => {
    render(<Typesend />);

    expect(
      screen.getByRole("button", { name: "Send message" })
    ).toBeDisabled();
  });

  it("keeps the send button disabled for whitespace-only messages", async () => {
    const user = userEvent.setup();

    render(<Typesend />);

    const input = screen.getByPlaceholderText("Type here");
    const button = screen.getByRole("button", { name: "Send message" });

    await user.type(input, "   ");

    expect(button).toBeDisabled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("sends a message and clears the input after success", async () => {
    const user = userEvent.setup();

    render(<Typesend />);

    const input = screen.getByPlaceholderText("Type here");
    const button = screen.getByRole("button", { name: "Send message" });

    await user.type(input, "Hello there");

    expect(button).toBeEnabled();

    await user.click(button);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith("Hello there");
    expect(input).toHaveValue("");
  });

  it("shows an error and keeps the message when sending fails", async () => {
    const user = userEvent.setup();

    mockSendMessage.mockResolvedValue(false);

    render(<Typesend />);

    const input = screen.getByPlaceholderText("Type here");

    await user.type(input, "Hello there");

    await user.click(
      screen.getByRole("button", { name: "Send message" })
    );

    expect(mockSendMessage).toHaveBeenCalledWith("Hello there");
    expect(mockToastError).toHaveBeenCalledWith(
      "Unable to send message"
    );
    expect(input).toHaveValue("Hello there");
  });

  it("does not send another message while loading", async () => {
    const user = userEvent.setup();

    mockedState.loading = true;

    render(<Typesend />);

    const input = screen.getByPlaceholderText("Type here");
    const button = screen.getByRole("button", { name: "Send message" });

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();

    await user.click(button);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("submits when the user presses Enter", async () => {
    const user = userEvent.setup();

    render(<Typesend />);

    const input = screen.getByPlaceholderText("Type here");

    await user.type(input, "Hello{Enter}");

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith("Hello");
  });
});