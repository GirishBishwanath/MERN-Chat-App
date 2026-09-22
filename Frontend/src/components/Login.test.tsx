import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

const { mockedPost, mockedSetAuthUser, mockedToastSuccess, mockedToastError } =
  vi.hoisted(() => ({
    mockedPost: vi.fn(),
    mockedSetAuthUser: vi.fn(),
    mockedToastSuccess: vi.fn(),
    mockedToastError: vi.fn(),
  }));

vi.mock("../utils/axiosConfig", () => ({
  default: {
    post: mockedPost,
  },
}));

vi.mock("../context/AuthProvider", () => ({
  useAuth: () => ({
    authUser: null,
    authStatus: "unauthenticated",
    setAuthUser: mockedSetAuthUser,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: mockedToastSuccess,
    error: mockedToastError,
  },
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows required validation when submitted empty", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByDisplayValue("Login"));

    expect(screen.getAllByText("This field is required")).toHaveLength(2);
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("submits credentials and authenticates the user on success", async () => {
    const user = userEvent.setup();

    mockedPost.mockResolvedValueOnce({
      data: {
        user: {
          _id: "user-1",
          fullname: "Test User",
          email: "test@example.com",
        },
      },
    });

    renderLogin();

    await user.type(
      screen.getByPlaceholderText("Email"),
      "test@example.com"
    );
    await user.type(screen.getByPlaceholderText("password"), "password123");
    await user.click(screen.getByDisplayValue("Login"));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith("/api/user/login", {
        email: "test@example.com",
        password: "password123",
      });
    });

    expect(mockedSetAuthUser).toHaveBeenCalledWith({
      _id: "user-1",
      fullname: "Test User",
      email: "test@example.com",
    });

    expect(mockedToastSuccess).toHaveBeenCalledWith("Login successful");
    expect(mockedToastError).not.toHaveBeenCalled();
  });

  it("shows the API error when login fails with an API response", async () => {
    const user = userEvent.setup();

    mockedPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: {
          error: "Invalid email or password",
        },
      },
    });

    renderLogin();

    await user.type(
      screen.getByPlaceholderText("Email"),
      "wrong@example.com"
    );
    await user.type(screen.getByPlaceholderText("password"), "wrong-password");
    await user.click(screen.getByDisplayValue("Login"));

    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalledWith(
        "Invalid email or password"
      );
    });

    expect(mockedSetAuthUser).not.toHaveBeenCalled();
  });

  it("shows a fallback error when login fails without an API message", async () => {
    const user = userEvent.setup();

    mockedPost.mockRejectedValueOnce(new Error("Network failure"));

    renderLogin();

    await user.type(
      screen.getByPlaceholderText("Email"),
      "test@example.com"
    );
    await user.type(screen.getByPlaceholderText("password"), "password123");
    await user.click(screen.getByDisplayValue("Login"));

    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalledWith("Unable to log in");
    });

    expect(mockedSetAuthUser).not.toHaveBeenCalled();
  });

  it("provides navigation from login to signup", () => {
    renderLogin();

    const signupLink = screen.getByRole("link", { name: "Signup" });

    expect(signupLink).toHaveAttribute("href", "/signup");
  });
});