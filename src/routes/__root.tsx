import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DnsIcon from "@mui/icons-material/Dns";
import InventoryIcon from "@mui/icons-material/Inventory";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleIcon from "@mui/icons-material/People";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import {
  AppBar,
  Avatar,
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
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState, type ReactElement } from "react";
import { useAuth, type AuthContext } from "../auth/AuthProvider";

interface RouterContext {
  auth: AuthContext;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

const drawerWidth = 280;

type NavigationPath =
  | "/"
  | "/customers"
  | "/suppliers"
  | "/products"
  | "/product-purchases"
  | "/orders"
  | "/infrastructure";

interface NavigationItem {
  label: string;
  description: string;
  to: NavigationPath;
  icon: ReactElement;
}

const navigationItems = [
  {
    label: "儀表板",
    description: "營運總覽",
    to: "/",
    icon: <DashboardIcon />,
  },
  {
    label: "訂單管理",
    description: "採購、入庫與出貨",
    to: "/orders",
    icon: <ReceiptLongIcon />,
  },
  {
    label: "商品管理",
    description: "商品、照片與規格",
    to: "/products",
    icon: <InventoryIcon />,
  },
  {
    label: "單品採購",
    description: "以商品角度管理採購",
    to: "/product-purchases",
    icon: <InventoryIcon />,
  },
  {
    label: "供應商管理",
    description: "供應商聯絡資料",
    to: "/suppliers",
    icon: <BusinessIcon />,
  },
  {
    label: "客戶管理",
    description: "客戶資料與狀態",
    to: "/customers",
    icon: <PeopleIcon />,
  },
  {
    label: "基礎設施",
    description: "Amplify 資源檢視",
    to: "/infrastructure",
    icon: <DnsIcon />,
  },
] as const satisfies readonly NavigationItem[];

function isNavigationItemSelected(pathname: string, to: NavigationPath) {
  if (to === "/") {
    return pathname === "/";
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

function getCurrentSectionLabel(pathname: string) {
  return (
    navigationItems.find((item) => isNavigationItemSelected(pathname, item.to))
      ?.label ?? "訂單管理系統"
  );
}

function RootComponent() {
  // 使用 useAuth() 直接訂閱 AuthContext，確保 isLoading 等狀態變更時能觸發重新渲染。
  // Route.useRouteContext() 的 auth 物件僅在路由導航時更新，不適合用於即時 UI 反應。
  const auth = useAuth();
  const theme = useTheme();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(true);

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

  if (!auth.isAuthenticated) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <PublicAppBar />
        <Box
          component="main"
          sx={{
            maxWidth: 1200,
            mx: "auto",
            px: { xs: 2, sm: 3 },
            py: { xs: 3, md: 4 },
          }}
        >
          <Outlet />
        </Box>
        <TanStackRouterDevtools position="top-right" />
      </Box>
    );
  }

  const sectionLabel = getCurrentSectionLabel(pathname);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: alpha(theme.palette.primary.main, 0.03),
      }}
    >
      <SideMenu
        pathname={pathname}
        open={desktopMenuOpen}
        onToggle={() => setDesktopMenuOpen((prev) => !prev)}
      />
      {!desktopMenuOpen && (
        <IconButton
          aria-label="開啟側邊選單"
          onClick={() => setDesktopMenuOpen(true)}
          sx={{
            display: { xs: "none", md: "inline-flex" },
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: (muiTheme) => muiTheme.zIndex.appBar + 1,
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}
      <MobileAppBar
        sectionLabel={sectionLabel}
        mobileOpen={mobileOpen}
        onToggleMenu={() => setMobileOpen((prev) => !prev)}
      />
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        <NavigationPanel
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: {
            md: desktopMenuOpen ? `calc(100% - ${drawerWidth}px)` : "100%",
          },
        }}
      >
        <Toolbar sx={{ display: { xs: "block", md: "none" } }} />
        <Stack
          spacing={3}
          sx={{
            width: "100%",
            maxWidth: 1680,
            boxSizing: "border-box",
            mx: "auto",
            px: { xs: 2, sm: 3, md: 4, xl: 5 },
            py: { xs: 2, md: 3, xl: 4 },
          }}
        >
          <Outlet />
        </Stack>
      </Box>
      <TanStackRouterDevtools position="top-right" />
    </Box>
  );
}

function PublicAppBar() {
  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: "background.paper",
        color: "text.primary",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <BrandMark />
        <Typography
          variant="h6"
          component={Link}
          to="/"
          noWrap
          sx={{
            color: "inherit",
            flexGrow: 1,
            minWidth: 0,
            textDecoration: "none",
          }}
        >
          訂單管理系統
        </Typography>
        <Button
          variant="contained"
          component={Link}
          to="/login"
          startIcon={<LoginIcon />}
        >
          登入
        </Button>
      </Toolbar>
    </AppBar>
  );
}

interface MobileAppBarProps {
  sectionLabel: string;
  mobileOpen: boolean;
  onToggleMenu: () => void;
}

function MobileAppBar({
  sectionLabel,
  mobileOpen,
  onToggleMenu,
}: MobileAppBarProps) {
  const auth = useAuth();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        display: { xs: "block", md: "none" },
        bgcolor: "background.paper",
        color: "text.primary",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <IconButton
          edge="start"
          aria-label={mobileOpen ? "隱藏選單" : "開啟選單"}
          onClick={onToggleMenu}
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </IconButton>
        <Typography variant="h6" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
          {sectionLabel}
        </Typography>
        <Tooltip title="個人資料">
          <IconButton component={Link} to="/profile" aria-label="個人資料">
            <AccountCircleIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="登出">
          <IconButton aria-label="登出" onClick={() => auth.signOut()}>
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}

interface SideMenuProps {
  pathname: string;
  open: boolean;
  onToggle: () => void;
}

function SideMenu({ pathname, open, onToggle }: SideMenuProps) {
  return (
    <Box
      sx={{
        display: { xs: "none", md: "flex" },
        width: { md: open ? drawerWidth : 0 },
        flexShrink: 0,
        overflow: "hidden",
        transition: (theme) =>
          theme.transitions.create("width", {
            duration: theme.transitions.duration.standard,
            easing: theme.transitions.easing.easeInOut,
          }),
      }}
    >
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            backgroundImage: "none",
            transform: open ? "translateX(0)" : `translateX(-${drawerWidth}px)`,
            transition: (theme) =>
              theme.transitions.create("transform", {
                duration: theme.transitions.duration.standard,
                easing: theme.transitions.easing.easeInOut,
              }),
          },
        }}
      >
        <NavigationPanel
          pathname={pathname}
          onToggleDesktop={onToggle}
          showDesktopToggle
        />
      </Drawer>
    </Box>
  );
}

interface NavigationPanelProps {
  pathname: string;
  onNavigate?: () => void;
  onToggleDesktop?: () => void;
  showDesktopToggle?: boolean;
}

function NavigationPanel({
  pathname,
  onNavigate,
  onToggleDesktop,
  showDesktopToggle = false,
}: NavigationPanelProps) {
  const auth = useAuth();

  return (
    <Stack sx={{ height: "100%" }}>
      <Toolbar sx={{ minHeight: 72, gap: 1.5, px: 2 }}>
        <BrandMark />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle1" noWrap>
            訂單管理系統
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            採購、入庫、出貨
          </Typography>
        </Box>
        {showDesktopToggle && (
          <Tooltip title="隱藏側邊選單">
            <IconButton
              aria-label="隱藏側邊選單"
              onClick={onToggleDesktop}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              <MenuIcon />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, px: 1.5, py: 2 }}>
        {navigationItems.map((item) => (
          <ListItem
            key={item.to}
            disablePadding
            sx={{ display: "block", mb: 0.5 }}
          >
            <ListItemButton
              component={Link}
              to={item.to}
              selected={isNavigationItemSelected(pathname, item.to)}
              aria-label={item.label}
              onClick={onNavigate}
              sx={{
                minHeight: 56,
                borderRadius: 1.5,
                px: 1.5,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                  "& .MuiListItemIcon-root": {
                    color: "inherit",
                  },
                  "& .MuiTypography-root": {
                    color: "inherit",
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: "text.secondary",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {item.label}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Button
            fullWidth
            variant="outlined"
            component={Link}
            to="/profile"
            startIcon={<AccountCircleIcon />}
            onClick={onNavigate}
            sx={{ justifyContent: "flex-start" }}
          >
            個人資料
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={() => {
              onNavigate?.();
              void auth.signOut();
            }}
            sx={{ justifyContent: "flex-start" }}
          >
            登出
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}

function BrandMark() {
  return (
    <Avatar
      variant="rounded"
      sx={{
        width: 36,
        height: 36,
        bgcolor: "primary.main",
        color: "primary.contrastText",
      }}
    >
      <ReceiptLongIcon fontSize="small" />
    </Avatar>
  );
}
