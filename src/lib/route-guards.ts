import type { AuthContext } from "@/auth/AuthProvider";
import { redirect } from "@tanstack/react-router";

type AuthRouteContext = {
  auth: Pick<AuthContext, "isAuthenticated" | "isLoading">;
};

type AuthRouteArgs = {
  context: AuthRouteContext;
};

export function requireAuth({ context }: AuthRouteArgs) {
  if (context.auth.isLoading) {
    return;
  }

  if (!context.auth.isAuthenticated) {
    throw redirect({ to: "/" });
  }
}

export function redirectIfAuthenticated({ context }: AuthRouteArgs) {
  if (context.auth.isAuthenticated) {
    throw redirect({ to: "/" });
  }
}
