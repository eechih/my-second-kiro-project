import { createFileRoute } from "@tanstack/react-router";
import { Box, Typography, Button, Paper, Avatar } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { auth } = Route.useRouteContext();

  if (!auth.isAuthenticated) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
        <Paper elevation={3} sx={{ p: 4, textAlign: "center", maxWidth: 400 }}>
          <Typography variant="h4" gutterBottom>
            歡迎
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            請使用 Google 帳號登入以繼續
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={() => auth.signInWithGoogle()}
          >
            使用 Google 登入
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, maxWidth: 600 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar sx={{ bgcolor: "primary.main" }}>
            {auth.userAttributes?.email?.charAt(0).toUpperCase() ?? "?"}
          </Avatar>
          <Box>
            <Typography variant="h5">
              你好，
              {auth.userAttributes?.name ??
                auth.userAttributes?.email ??
                "使用者"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {auth.userAttributes?.email}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
