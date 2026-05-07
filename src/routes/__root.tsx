import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Toolbar,
  Typography,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import BusinessIcon from "@mui/icons-material/Business";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DnsIcon from "@mui/icons-material/Dns";
import InventoryIcon from "@mui/icons-material/Inventory";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleIcon from "@mui/icons-material/People";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState, type ReactElement } from "react";
import { useTheme, type Theme } from "@mui/material/styles";
import { useAuth, type AuthContext } from "../auth/AuthProvider";

interface RouterContext {
  auth: AuthContext;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

const drawerWidth = 240;

type NavigationPath =
  | "/"
  | "/customers"
  | "/suppliers"
  | "/products"
  | "/orders"
  | "/infrastructure";

interface NavigationItem {
  label: string;
  to: NavigationPath;
  icon: ReactElement;
}

const navigationItems = [
  { label: "儀表板", to: "/", icon: <DashboardIcon /> },
  { label: "客戶管理", to: "/customers", icon: <PeopleIcon /> },
  { label: "供應商管理", to: "/suppliers", icon: <BusinessIcon /> },
  { label: "商品管理", to: "/products", icon: <InventoryIcon /> },
  { label: "訂單管理", to: "/orders", icon: <ReceiptLongIcon /> },
  { label: "基礎設施", to: "/infrastructure", icon: <DnsIcon /> },
] as const satisfies readonly NavigationItem[];

function getClosedDrawerWidth(theme: Theme) {
  return {
    width: `calc(${theme.spacing(7)} + 1px)`,
    [theme.breakpoints.up("sm")]: {
      width: `calc(${theme.spacing(8)} + 1px)`,
    },
  };
}

function isNavigationItemSelected(pathname: string, to: NavigationPath) {
  if (to === "/") {
    return pathname === "/";
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

function RootComponent() {
  // 使用 useAuth() 直接訂閱 AuthContext，確保 isLoading 等狀態變更時能觸發重新渲染。
  // Route.useRouteContext() 的 auth 物件僅在路由導航時更新，不適合用於即時 UI 反應。
  const auth = useAuth();
  const theme = useTheme();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: drawerOpen
              ? theme.transitions.duration.enteringScreen
              : theme.transitions.duration.leavingScreen,
          }),
          ...(auth.isAuthenticated &&
            drawerOpen && {
              ml: `${drawerWidth}px`,
              width: `calc(100% - ${drawerWidth}px)`,
            }),
        }}
      >
        <Toolbar>
          {auth.isAuthenticated && (
            <IconButton
              color="inherit"
              aria-label="開啟選單"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{
                display: drawerOpen ? "none" : "inline-flex",
                mr: 2,
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component={Link}
            to="/"
            noWrap
            sx={{
              textDecoration: "none",
              color: "inherit",
              flexGrow: 1,
              minWidth: 0,
              mr: 2,
            }}
          >
            訂單管理系統
          </Typography>
          {auth.isAuthenticated ? (
            <>
              <Button
                color="inherit"
                component={Link}
                to="/profile"
                aria-label="個人資料"
                startIcon={<AccountCircleIcon />}
                sx={{
                  minWidth: { xs: 40, sm: "auto" },
                  px: { xs: 1, sm: 2 },
                  "& .MuiButton-startIcon": {
                    mr: { xs: 0, sm: 1 },
                  },
                }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  個人資料
                </Box>
              </Button>
              <Button
                color="inherit"
                aria-label="登出"
                startIcon={<LogoutIcon />}
                onClick={() => auth.signOut()}
                sx={{
                  minWidth: { xs: 40, sm: "auto" },
                  px: { xs: 1, sm: 2 },
                  "& .MuiButton-startIcon": {
                    mr: { xs: 0, sm: 1 },
                  },
                }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  登出
                </Box>
              </Button>
            </>
          ) : (
            <Button
              color="inherit"
              component={Link}
              to="/login"
              aria-label="登入"
              startIcon={<LoginIcon />}
              sx={{
                minWidth: { xs: 40, sm: "auto" },
                px: { xs: 1, sm: 2 },
                "& .MuiButton-startIcon": {
                  mr: { xs: 0, sm: 1 },
                },
              }}
            >
              登入
            </Button>
          )}
        </Toolbar>
      </AppBar>
      {auth.isAuthenticated && (
        <Drawer
          variant="permanent"
          open={drawerOpen}
          sx={{
            flexShrink: 0,
            whiteSpace: "nowrap",
            boxSizing: "border-box",
            ...(drawerOpen ? { width: drawerWidth } : getClosedDrawerWidth(theme)),
            "& .MuiDrawer-paper": {
              overflowX: "hidden",
              whiteSpace: "nowrap",
              boxSizing: "border-box",
              transition: theme.transitions.create("width", {
                easing: theme.transitions.easing.sharp,
                duration: drawerOpen
                  ? theme.transitions.duration.enteringScreen
                  : theme.transitions.duration.leavingScreen,
              }),
              ...(drawerOpen ? { width: drawerWidth } : getClosedDrawerWidth(theme)),
            },
          }}
        >
          <Toolbar
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: drawerOpen ? "flex-end" : "center",
              px: 1,
            }}
          >
            <IconButton
              aria-label="收合選單"
              onClick={() => setDrawerOpen(false)}
              sx={{ display: drawerOpen ? "inline-flex" : "none" }}
            >
              {theme.direction === "rtl" ? (
                <ChevronRightIcon />
              ) : (
                <ChevronLeftIcon />
              )}
            </IconButton>
          </Toolbar>
          <Divider />
          <List>
            {navigationItems.map((item) => (
              <ListItem key={item.to} disablePadding sx={{ display: "block" }}>
                <Tooltip
                  title={drawerOpen ? "" : item.label}
                  placement="right"
                  disableInteractive
                >
                  <ListItemButton
                    component={Link}
                    to={item.to}
                    selected={isNavigationItemSelected(pathname, item.to)}
                    aria-label={item.label}
                    sx={{
                      minHeight: 48,
                      justifyContent: drawerOpen ? "initial" : "center",
                      px: 2.5,
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: drawerOpen ? 3 : "auto",
                        justifyContent: "center",
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      sx={{ opacity: drawerOpen ? 1 : 0 }}
                    />
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </Drawer>
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: 3,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
      <TanStackRouterDevtools />
    </Box>
  );
}
