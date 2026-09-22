import { act, render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";

const { mockedGet, mockedPost } = vi.hoisted(() => ({
  mockedGet: vi.fn(),
  mockedPost: vi.fn(),
}));

vi.mock("../utils/axiosConfig", () => ({
  default: {
    get: mockedGet,
    post: mockedPost,
  },
}));

function AuthConsumer() {
  const { authUser, authStatus } = useAuth();

  return (
    <div>
      <span data-testid="auth-status">{authStatus}</span>
      <span data-testid="auth-user">
        {authUser?.fullname ?? "no-user"}
      </span>
    </div>
  );
}

function renderAuthProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

function unauthorizedError(): AxiosError {
  const error = new AxiosError("Unauthorized", "ERR_BAD_REQUEST");

  Object.defineProperty(error, "response", {
    value: {
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config: {},
      data: {},
    },
  });

  return error;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores an authenticated session from /me", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        user: {
          _id: "user-1",
          fullname: "Test User",
          email: "test@example.com",
        },
      },
    });

    renderAuthProvider();

    expect(screen.getByTestId("auth-status")).toHaveTextContent("loading");

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "authenticated"
      );
    });

    expect(screen.getByTestId("auth-user")).toHaveTextContent("Test User");
    expect(mockedGet).toHaveBeenCalledWith("/api/user/me");
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("refreshes the session when /me returns 401", async () => {
    mockedGet.mockRejectedValueOnce(unauthorizedError());

    mockedPost.mockResolvedValueOnce({
      data: {
        user: {
          _id: "user-2",
          fullname: "Refreshed User",
          email: "refresh@example.com",
        },
      },
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "authenticated"
      );
    });

    expect(screen.getByTestId("auth-user")).toHaveTextContent(
      "Refreshed User"
    );
    expect(mockedPost).toHaveBeenCalledWith("/api/user/refresh");
  });

  it("becomes unauthenticated when /me returns 401 and refresh fails", async () => {
    mockedGet.mockRejectedValueOnce(unauthorizedError());
    mockedPost.mockRejectedValueOnce(unauthorizedError());

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "unauthenticated"
      );
    });

    expect(screen.getByTestId("auth-user")).toHaveTextContent("no-user");
  });

  it("becomes unauthenticated when /me fails with a non-401 error", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network failure"));

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "unauthenticated"
      );
    });

    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("clears the authenticated user when auth:expired is dispatched", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        user: {
          _id: "user-3",
          fullname: "Authenticated User",
          email: "authenticated@example.com",
        },
      },
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "authenticated"
      );
    });

    act(() => {
      window.dispatchEvent(new Event("auth:expired"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent(
        "unauthenticated"
      );
    });

    expect(screen.getByTestId("auth-user")).toHaveTextContent("no-user");
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const InvalidConsumer = () => {
      useAuth();
      return null;
    };

    try {
      expect(() => render(<InvalidConsumer />)).toThrow(
        "useAuth must be used within an AuthProvider"
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});