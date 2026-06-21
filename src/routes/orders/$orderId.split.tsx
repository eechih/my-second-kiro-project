import { PageHeader } from "@/components/PageHeader";
import { requireAuth } from "@/lib/route-guards";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/orders/$orderId/split")({
  beforeLoad: requireAuth,
  component: OrderSplitPage,
});

function OrderSplitPage() {
  const navigate = useNavigate();
  const { orderId } = Route.useParams();

  return (
    <Box>
      <PageHeader
        section="訂單"
        current="分拆"
        title="分拆訂單"
        actions={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() =>
              navigate({
                to: "/orders/$orderId" as string,
                params: { orderId } as Record<string, string>,
              })
            }
          >
            返回
          </Button>
        }
      />

      <Alert severity="info" sx={{ mt: 2 }}>
        訂單分拆功能已停用。如有需要，請聯繫系統管理員。
      </Alert>

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate({ to: "/orders", search: { customerId: undefined, customerName: undefined } })}
        sx={{ mt: 2 }}
      >
        返回訂單列表
      </Button>
    </Box>
  );
}
