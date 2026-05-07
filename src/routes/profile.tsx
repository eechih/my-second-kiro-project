import {
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { requireAuth } from "@/lib/route-guards";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuth,
  component: ProfilePage,
});

function ProfilePage() {
  const { auth } = Route.useRouteContext();
  const attrs = auth.userAttributes;

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Typography variant="h4" gutterBottom>
        個人資料
      </Typography>
      <Paper elevation={2}>
        <List>
          <ListItem>
            <ListItemText primary="使用者 ID" secondary={auth.user?.userId} />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText primary="名稱" secondary={attrs?.name ?? "—"} />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText primary="Email" secondary={attrs?.email ?? "—"} />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText
              primary="Email 已驗證"
              secondary={attrs?.email_verified === "true" ? "是" : "否"}
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
}
