import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

const mockedAuth = vi.hoisted(() => ({
  authUser: null as
    | {
        _id: string;
        fullname: string;
        email: string;
      }
    | null,
  authStatus: "loading" as "loading" | "authenticated" | "unauthenticated",
}));

vi.mock("./context/AuthProvider", () => ({
  useAuth: () => mockedAuth,
}));

vi.mock("./components/Login", () => ({
  default: () => <div>Login Page</div>,
}));

vi.mock("./components/Signup", () => ({
  default: () => <div>Signup Page</div>,
}));

vi.mock("./home/Leftpart/Left", () => ({
  default: () => <div>Left Panel</div>,
}));

vi.mock("./home/Rightpart/Right", () => ({
  default: () => <div>Right Panel</div>,
}));

vi.mock("./home/left1/Logout", () => ({
  default: () => <div>Logout</div>,
}));

vi.mock("react-hot-toast", () => ({
  Toaster: () => null,
}));

function renderApp(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>
  );
}

describe("App", () => {
  it("shows a loading state while authentication is being restored", () => {
    mockedAuth.authStatus = "loading";
    mockedAuth.authUser = null;

    renderApp("/");

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects unauthenticated users from the root route to login", () => {
    mockedAuth.authStatus = "unauthenticated";
    mockedAuth.authUser = null;

    renderApp("/");

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Left Panel")).not.toBeInTheDocument();
  });

  it("renders the chat application for authenticated users at the root route", () => {
    mockedAuth.authStatus = "authenticated";
    mockedAuth.authUser = {
      _id: "user-1",
      fullname: "Test User",
      email: "test@example.com",
    };

    renderApp("/");

    expect(screen.getByText("Left Panel")).toBeInTheDocument();
    expect(screen.getByText("Right Panel")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("renders login for unauthenticated users at /login", () => {
    mockedAuth.authStatus = "unauthenticated";
    mockedAuth.authUser = null;

    renderApp("/login");

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("redirects authenticated users from /login to the root route", () => {
    mockedAuth.authStatus = "authenticated";
    mockedAuth.authUser = {
      _id: "user-1",
      fullname: "Test User",
      email: "test@example.com",
    };

    renderApp("/login");

    expect(screen.getByText("Left Panel")).toBeInTheDocument();
    expect(screen.getByText("Right Panel")).toBeInTheDocument();
  });

  it("renders signup for unauthenticated users at /signup", () => {
    mockedAuth.authStatus = "unauthenticated";
    mockedAuth.authUser = null;

    renderApp("/signup");

    expect(screen.getByText("Signup Page")).toBeInTheDocument();
  });

  it("redirects authenticated users from /signup to the root route", () => {
    mockedAuth.authStatus = "authenticated";
    mockedAuth.authUser = {
      _id: "user-1",
      fullname: "Test User",
      email: "test@example.com",
    };

    renderApp("/signup");

    expect(screen.getByText("Left Panel")).toBeInTheDocument();
    expect(screen.getByText("Right Panel")).toBeInTheDocument();
  });
});