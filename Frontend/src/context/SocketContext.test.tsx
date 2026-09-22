import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SocketProvider, useSocketContext } from "./SocketContext";

const { mockIo, mockGet } = vi.hoisted(() => ({
  mockIo: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  io: mockIo,
}));

vi.mock("../utils/axiosConfig", () => ({
  default: {
    get: mockGet,
  },
}));

const mockedAuth = vi.hoisted(() => ({
  authUser: {
    _id: "user-1",
    fullname: "Test User",
    email: "test@example.com",
  } as { _id: string; fullname: string; email: string } | null,
}));

vi.mock("./AuthProvider", () => ({
  useAuth: () => mockedAuth,
}));

type Handler = (...args: unknown[]) => void;

interface MockSocket {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  handlers: Map<string, Handler>;
}

function createMockSocket(): MockSocket {
  const handlers = new Map<string, Handler>();

  const socket: MockSocket = {
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    close: vi.fn(),
    handlers,
  };

  return socket;
}

function Harness() {
  const { socket, onlineUsers, connectionStatus } = useSocketContext();

  return (
    <div>
      <div data-testid="socket">
        {socket ? "connected-object" : "no-socket"}
      </div>
      <div data-testid="status">{connectionStatus}</div>
      <div data-testid="online-users">{onlineUsers.join(",")}</div>
    </div>
  );
}

function renderProvider() {
  return render(
    <SocketProvider>
      <Harness />
    </SocketProvider>
  );
}

describe("SocketProvider", () => {
  let socket: MockSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuth.authUser = {
      _id: "user-1",
      fullname: "Test User",
      email: "test@example.com",
    };

    socket = createMockSocket();
    mockIo.mockReturnValue(socket);
  });

  it("creates a socket and starts in connecting state for an authenticated user", () => {
    renderProvider();

    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        withCredentials: true,
      })
    );

    expect(screen.getByTestId("status")).toHaveTextContent("connecting");
    expect(screen.getByTestId("socket")).toHaveTextContent("connected-object");
  });

  it("moves to connected when the socket connects", () => {
    renderProvider();

    act(() => {
      socket.handlers.get("connect")?.();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("connected");
  });

  it("tracks online users from the server", () => {
    renderProvider();

    act(() => {
      socket.handlers.get("getOnlineUsers")?.([
        "user-2",
        "user-3",
      ]);
    });

    expect(screen.getByTestId("online-users")).toHaveTextContent(
      "user-2,user-3"
    );
  });

  it("moves to reconnecting and clears online users after disconnect", () => {
    renderProvider();

    act(() => {
      socket.handlers.get("getOnlineUsers")?.(["user-2"]);
      socket.handlers.get("disconnect")?.();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("reconnecting");
    expect(screen.getByTestId("online-users")).toHaveTextContent("");
  });

  it("moves to reconnecting after a transient connection error without expiring auth", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    renderProvider();

    act(() => {
      socket.handlers.get("connect_error")?.(new Error("network failure"));
    });

    expect(screen.getByTestId("status")).toHaveTextContent("reconnecting");
    expect(screen.getByTestId("online-users")).toHaveTextContent("");
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "auth:expired",
      })
    );

    dispatchSpy.mockRestore();
  });

  it("expires authentication for non-expired authentication failures", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    renderProvider();

    const error = Object.assign(new Error("invalid auth"), {
      data: {
        code: "AUTH_INVALID",
      },
    });

    act(() => {
      socket.handlers.get("connect_error")?.(error);
    });

    expect(socket.disconnect).toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "auth:expired",
      })
    );

    dispatchSpy.mockRestore();
  });

  it("checks the current session and reconnects after AUTH_EXPIRED", async () => {
    mockGet.mockResolvedValueOnce({ data: {} });

    renderProvider();

    const error = Object.assign(new Error("expired"), {
      data: {
        code: "AUTH_EXPIRED",
      },
    });

    act(() => {
      socket.handlers.get("connect_error")?.(error);
    });

    expect(mockGet).toHaveBeenCalledWith("/api/user/me");
    expect(socket.disconnect).toHaveBeenCalled();

    await waitFor(() => {
      expect(socket.connect).toHaveBeenCalled();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("connecting");
  });

  it("expires authentication when AUTH_EXPIRED session recovery fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("session unavailable"));

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    renderProvider();

    const error = Object.assign(new Error("expired"), {
      data: {
        code: "AUTH_EXPIRED",
      },
    });

    act(() => {
      socket.handlers.get("connect_error")?.(error);
    });

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "auth:expired",
        })
      );
    });

    dispatchSpy.mockRestore();
  });

  it("closes the socket when the user becomes unauthenticated", () => {
    const { rerender } = render(
      <SocketProvider>
        <Harness />
      </SocketProvider>
    );

    expect(mockIo).toHaveBeenCalled();

    mockedAuth.authUser = null;

    rerender(
      <SocketProvider>
        <Harness />
      </SocketProvider>
    );

    expect(socket.close).toHaveBeenCalled();
    expect(screen.getByTestId("status")).toHaveTextContent("disconnected");
    expect(screen.getByTestId("socket")).toHaveTextContent("no-socket");
  });

  it("throws when useSocketContext is used outside the provider", () => {
    function InvalidConsumer() {
      useSocketContext();
      return null;
    }

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() => render(<InvalidConsumer />)).toThrow(
      "useSocketContext must be used within a SocketProvider"
    );

    consoleError.mockRestore();
  });
});