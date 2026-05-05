import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme";
import type { AuthContext } from "../auth/AuthProvider";

// Mock aws-amplify/auth so AuthProvider imports don't fail
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")),
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  fetchUserAttributes: vi.fn(),
}));

const mockNavigate = vi.fn();

// Capture the component passed to createFileRoute(...).component
let CapturedComponent: React.ComponentType | null = null;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => {
    CapturedComponent = options.component;
    return { options };
  },
  redirect: vi.fn(),
  useNavigate: () => mockNavigate,
}));

function createMockAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    userAttributes: null,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    confirmSignUp: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

const mockAuth = createMockAuth();

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => mockAuth,
}));

async function renderLoginPage() {
  // Dynamically import the module to trigger createFileRoute and capture the component
  await import("./login");

  if (!CapturedComponent) {
    throw new Error("LoginPage component was not captured from route");
  }
  const PageComponent = CapturedComponent;

  render(
    <ThemeProvider theme={theme}>
      <PageComponent />
    </ThemeProvider>,
  );
}

describe("LoginPage", () => {
  it("renders without crashing and shows the sign-in heading", async () => {
    await renderLoginPage();

    expect(screen.getByRole("heading", { name: "登入" })).toBeInTheDocument();
  });

  it("renders email and password fields", async () => {
    await renderLoginPage();

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("密碼")).toBeInTheDocument();
  });

  it("renders the sign-in submit button", async () => {
    await renderLoginPage();

    expect(screen.getByRole("button", { name: /登入/ })).toBeInTheDocument();
  });

  it("renders a link to switch to sign-up mode", async () => {
    await renderLoginPage();

    expect(screen.getByText("註冊")).toBeInTheDocument();
  });
});
