import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  getCurrentUser,
  signOut as amplifySignOut,
  signInWithRedirect,
  fetchUserAttributes,
  type AuthUser,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

export interface AuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  userAttributes: Record<string, string | undefined> | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContext | null>(null);

export function useAuth(): AuthContext {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userAttributes, setUserAttributes] = useState<Record<
    string,
    string | undefined
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser(currentUser);
      setUserAttributes(attributes);
    } catch {
      setUser(null);
      setUserAttributes(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUser();

    const hubListener = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signInWithRedirect":
          checkUser();
          break;
        case "signInWithRedirect_failure":
          setIsLoading(false);
          break;
        case "signedOut":
          setUser(null);
          setUserAttributes(null);
          break;
      }
    });

    return () => hubListener();
  }, [checkUser]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithRedirect({ provider: "Google" });
  }, []);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUser(null);
    setUserAttributes(null);
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        isAuthenticated: !!user,
        isLoading,
        user,
        userAttributes,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
