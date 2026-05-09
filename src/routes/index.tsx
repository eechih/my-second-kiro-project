import { createFileRoute, Link } from "@tanstack/react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import InventoryIcon from "@mui/icons-material/Inventory";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { useDashboardSummary } from "@/hooks/useDashboard";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <Paper elevation={3} sx={{ p: 4, textAlign: "center", maxWidth: 400 }}>
          <Typography variant="h4" gutterBottom>
            歡迎
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            請登入以繼續使用
          </Typography>
          <Button variant="contained" size="large" component={Link} to="/login">
            前往登入
          </Button>
        </Paper>
      </Box>
    );
  }

  return <Dashboard />;
}

function Dashboard() {
  const { data, isLoading } = useDashboardSummary();

  return (
    <Box>
      <PageHeader section="儀表板" current="總覽" title="儀表板" />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardActionArea component={Link} to="/orders">
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mb: 1,
                  }}
                >
                  <ShoppingCartIcon color="primary" fontSize="large" />
                  <Typography variant="h6" color="text.secondary">
                    待處理訂單
                  </Typography>
                </Box>
                {isLoading ? (
                  <Skeleton variant="text" width={60} height={48} />
                ) : (
                  <Typography variant="h3" color="primary.main">
                    {data?.pendingOrdersCount ?? 0}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardActionArea component={Link} to="/orders">
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mb: 1,
                  }}
                >
                  <InventoryIcon color="warning" fontSize="large" />
                  <Typography variant="h6" color="text.secondary">
                    待入庫採購
                  </Typography>
                </Box>
                {isLoading ? (
                  <Skeleton variant="text" width={60} height={48} />
                ) : (
                  <Typography variant="h3" color="warning.main">
                    {data?.pendingProcurementCount ?? 0}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardActionArea component={Link} to="/orders">
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mb: 1,
                  }}
                >
                  <LocalShippingIcon color="success" fontSize="large" />
                  <Typography variant="h6" color="text.secondary">
                    待出貨明細
                  </Typography>
                </Box>
                {isLoading ? (
                  <Skeleton variant="text" width={60} height={48} />
                ) : (
                  <Typography variant="h3" color="success.main">
                    {data?.readyToShipLineItemsCount ?? 0}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
