import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";

// Mock aws-amplify/auth so AuthProvider can render without a real backend
vi.mock("aws-amplify/auth", () => ({
  getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")),
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  fetchUserAttributes: vi.fn(),
}));

describe("AuthProvider", () => {
  it("renders children without crashing", () => {
    render(
      <AuthProvider>
        <div data-testid="child">Hello</div>
      </AuthProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("provides auth context to children", () => {
    function Consumer() {
      const auth = useAuth();
      return <span data-testid="status">{String(auth.isAuthenticated)}</span>;
    }

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    // Initially not authenticated (getCurrentUser rejects)
    expect(screen.getByTestId("status")).toHaveTextContent("false");
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    function Orphan() {
      useAuth();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });
});
