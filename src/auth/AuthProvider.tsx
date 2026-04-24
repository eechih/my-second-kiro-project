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
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ isSignUpComplete: boolean; nextStep: string }>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
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

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      await amplifySignIn({ username: email, password });
      await checkUser();
    },
    [checkUser],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      const result = await amplifySignUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      return {
        isSignUpComplete: result.isSignUpComplete,
        nextStep: result.nextStep.signUpStep,
      };
    },
    [],
  );

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    await amplifyConfirmSignUp({ username: email, confirmationCode: code });
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
        signInWithEmail,
        signUpWithEmail,
        confirmSignUp,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
