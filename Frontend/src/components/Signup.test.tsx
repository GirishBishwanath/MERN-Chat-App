import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Signup from "./Signup";

const {
  mockedPost,
  mockedSetAuthUser,
  mockedToastSuccess,
  mockedToastError,
} = vi.hoisted(() => ({
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

function renderSignup() {
  return render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  );
}

describe("Signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows required validation when submitted empty", async () => {
    const user = userEvent.setup();

    renderSignup();

    await user.click(screen.getByDisplayValue("Signup"));

    expect(screen.getAllByText("This field is required")).toHaveLength(4);
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    const user = userEvent.setup();

    renderSignup();

    await user.type(screen.getByPlaceholderText("Fullname"), "Test User");
    await user.type(
      screen.getByPlaceholderText("Email"),
      "test@example.com"
    );
    await user.type(
      screen.getByPlaceholderText("password"),
      "password123"
    );
    await user.type(
      screen.getByPlaceholderText("confirm password"),
      "different-password"
    );

    await user.click(screen.getByDisplayValue("Signup"));

    expect(
      screen.getByText("Passwords do not match")
    ).toBeInTheDocument();

    expect(mockedPost).not.toHaveBeenCalled();
    expect(mockedSetAuthUser).not.toHaveBeenCalled();
  });

  it("submits signup data and authenticates the user on success", async () => {
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

    renderSignup();

    await user.type(screen.getByPlaceholderText("Fullname"), "Test User");
    await user.type(
      screen.getByPlaceholderText("Email"),
      "test@example.com"
    );
    await user.type(
      screen.getByPlaceholderText("password"),
      "password123"
    );
    await user.type(
      screen.getByPlaceholderText("confirm password"),
      "password123"
    );

    await user.click(screen.getByDisplayValue("Signup"));

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith("/api/user/signup", {
        fullname: "Test User",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      });
    });

    expect(mockedSetAuthUser).toHaveBeenCalledWith({
      _id: "user-1",
      fullname: "Test User",
      email: "test@example.com",
    });

    expect(mockedToastSuccess).toHaveBeenCalledWith("Signup successful");
    expect(mockedToastError).not.toHaveBeenCalled();
  });

  it("shows the API error when signup fails with an API response", async () => {
    const user = userEvent.setup();

    mockedPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: {
          error: "Email already exists",
        },
      },
    });

    renderSignup();

    await user.type(screen.getByPlaceholderText("Fullname"), "Existing User");
    await user.type(
      screen.getByPlaceholderText("Email"),
      "existing@example.com"
    );
    await user.type(
      screen.getByPlaceholderText("password"),
      "password123"
    );
    await user.type(
      screen.getByPlaceholderText("confirm password"),
      "password123"
    );

    await user.click(screen.getByDisplayValue("Signup"));

    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalledWith("Email already exists");
    });

    expect(mockedSetAuthUser).not.toHaveBeenCalled();
  });

  it("shows a fallback error when signup fails without an API message", async () => {
    const user = userEvent.setup();

    mockedPost.mockRejectedValueOnce(new Error("Network failure"));

    renderSignup();

    await user.type(screen.getByPlaceholderText("Fullname"), "Test User");
    await user.type(
      screen.getByPlaceholderText("Email"),
      "test@example.com"
    );
    await user.type(
      screen.getByPlaceholderText("password"),
      "password123"
    );
    await user.type(
      screen.getByPlaceholderText("confirm password"),
      "password123"
    );

    await user.click(screen.getByDisplayValue("Signup"));

    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalledWith(
        "Unable to create account"
      );
    });

    expect(mockedSetAuthUser).not.toHaveBeenCalled();
  });

  it("provides navigation from signup to login", () => {
    renderSignup();

    const loginLink = screen.getByRole("link", { name: "Login" });

    expect(loginLink).toHaveAttribute("href", "/login");
  });
});