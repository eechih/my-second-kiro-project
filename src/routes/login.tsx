import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Link,
  CircularProgress,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";

type AuthMode = "signIn" | "signUp" | "confirmSignUp";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { auth } = Route.useRouteContext();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await auth.signInWithEmail(email, password);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await auth.signUpWithEmail(email, password);
      if (!result.isSignUpComplete && result.nextStep === "CONFIRM_SIGN_UP") {
        setMode("confirmSignUp");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "註冊失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    setError("");
    setLoading(true);
    try {
      await auth.confirmSignUp(email, confirmCode);
      await auth.signInWithEmail(email, password);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "驗證失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    switch (mode) {
      case "signIn":
        handleSignIn();
        break;
      case "signUp":
        handleSignUp();
        break;
      case "confirmSignUp":
        handleConfirmSignUp();
        break;
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="60vh"
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 420, width: "100%" }}>
        <Typography variant="h5" textAlign="center" gutterBottom>
          {mode === "signIn" && "登入"}
          {mode === "signUp" && "註冊"}
          {mode === "confirmSignUp" && "驗證 Email"}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {mode === "confirmSignUp" ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                驗證碼已寄送至 {email}，請輸入驗證碼
              </Typography>
              <TextField
                label="驗證碼"
                fullWidth
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                sx={{ mb: 2 }}
                autoFocus
              />
            </>
          ) : (
            <>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
                autoFocus
              />
              <TextField
                label="密碼"
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 2 }}
              />
            </>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <EmailIcon />}
            sx={{ mb: 2 }}
          >
            {mode === "signIn" && "登入"}
            {mode === "signUp" && "註冊"}
            {mode === "confirmSignUp" && "確認驗證碼"}
          </Button>
        </form>

        {mode !== "confirmSignUp" && (
          <>
            <Box textAlign="center" sx={{ mb: 2 }}>
              {mode === "signIn" ? (
                <Typography variant="body2">
                  還沒有帳號？{" "}
                  <Link
                    component="button"
                    onClick={() => {
                      setMode("signUp");
                      setError("");
                    }}
                  >
                    註冊
                  </Link>
                </Typography>
              ) : (
                <Typography variant="body2">
                  已有帳號？{" "}
                  <Link
                    component="button"
                    onClick={() => {
                      setMode("signIn");
                      setError("");
                    }}
                  >
                    登入
                  </Link>
                </Typography>
              )}
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
