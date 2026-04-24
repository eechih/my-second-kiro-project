import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme";
import type { AuthContext } from "../auth/AuthProvider";
import type { QueryClient } from "@tanstack/react-query";

// Mock aws-amplify/auth so AuthProvider imports don't fail
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")),
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  fetchUserAttributes: vi.fn(),
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

const mockQueryClient = {} as QueryClient;

async function renderLoginPage(authOverrides: Partial<AuthContext> = {}) {
  const auth = createMockAuth(authOverrides);

  // Dynamically import the actual login route module
  const loginModule = await import("./login");

  const rootRoute = createRootRoute();
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: loginModule.Route.options.component,
  });
  rootRoute.addChildren([loginRoute]);

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/login"] }),
    context: { auth, queryClient: mockQueryClient },
  });

  render(
    <ThemeProvider theme={theme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );

  // Wait for the route to render
  return screen.findByText("登入", {}, { timeout: 3000 });
}

describe("LoginPage", () => {
  it("renders without crashing and shows the sign-in heading", async () => {
    await renderLoginPage();

    // The heading should show "登入"
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
