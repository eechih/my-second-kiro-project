import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import type { QueryClient } from "@tanstack/react-query";
import { useAuth, type AuthContext } from "../auth/AuthProvider";

interface RouterContext {
  auth: AuthContext;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  // 使用 useAuth() 直接訂閱 AuthContext，確保 isLoading 等狀態變更時能觸發重新渲染。
  // Route.useRouteContext() 的 auth 物件僅在路由導航時更新，不適合用於即時 UI 反應。
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{
              textDecoration: "none",
              color: "inherit",
              mr: 3,
            }}
          >
            訂單管理系統
          </Typography>
          {auth.isAuthenticated && (
            <Box sx={{ display: "flex", gap: 0.5, flexGrow: 1 }}>
              <Button color="inherit" component={Link} to="/customers">
                客戶管理
              </Button>
              <Button color="inherit" component={Link} to="/suppliers">
                供應商管理
              </Button>
              <Button color="inherit" component={Link} to="/products">
                商品管理
              </Button>
              <Button color="inherit" component={Link} to="/orders">
                訂單管理
              </Button>
            </Box>
          )}
          {!auth.isAuthenticated && <Box sx={{ flexGrow: 1 }} />}
          {auth.isAuthenticated ? (
            <>
              <Button color="inherit" component={Link} to="/profile">
                個人資料
              </Button>
              <Button color="inherit" onClick={() => auth.signOut()}>
                登出
              </Button>
            </>
          ) : (
            <Button color="inherit" component={Link} to="/login">
              登入
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 3 }}>
        <Outlet />
      </Box>
      <TanStackRouterDevtools />
    </>
  );
}
