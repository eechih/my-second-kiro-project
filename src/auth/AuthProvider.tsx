import {
  confirmSignUp as amplifyConfirmSignUp,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
  fetchUserAttributes,
  getCurrentUser,
  type AuthUser,
} from "aws-amplify/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AuthContext {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  userAttributes: Record<string, string | undefined> | null;
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
    console.log("checkUser...");
    try {
      const currentUser = await getCurrentUser();
      console.log("currentUser", currentUser);
      const attributes = await fetchUserAttributes();

      console.log("attributes", attributes);
      setUser(currentUser);
      setUserAttributes(attributes);
    } catch {
      setUser(null);
      setUserAttributes(null);
    } finally {
      console.log("setIsLoading to false");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

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
