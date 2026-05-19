import { PageHeader } from "@/components/PageHeader";
import { useOrder, useUpdateOrderStatus } from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { getNextAllowedOrderStatuses } from "@shared/logic/order-status";
import type { OrderStatus } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { InfoCard } from "./-components/detail/InfoCard";
import { OrderItemsCard } from "./-components/detail/OrderItemsCard";

export const Route = createFileRoute("/orders/$orderId")({
  beforeLoad: requireAuth,
  component: OrderDetailPage,
});

function OrderDetailPage(): React.ReactElement {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { data: order, isLoading, error: queryError } = useOrder(orderId);
  const updateStatus = useUpdateOrderStatus();
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleStatusChange = useCallback(
    async (newStatus: OrderStatus) => {
      if (!order) return;
      setStatusError(null);
      try {
        await updateStatus.mutateAsync({
          orderId: order.id,
          currentStatus: order.status,
          newStatus,
          statusHistory: order.statusHistory,
        });
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : "更新狀態失敗");
      }
    },
    [order, updateStatus],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (queryError || !order) {
    return (
      <Box>
        <Alert severity="error">{queryError?.message ?? "找不到該訂單"}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => void navigate({ to: "/orders" })}>
          返回訂單列表
        </Button>
      </Box>
    );
  }

  const allowedStatuses = getNextAllowedOrderStatuses(order.status);

  return (
    <Box>
      <PageHeader
        section="訂單"
        current={order.orderNumber}
        title="訂單詳情"
        actions={
          <>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => void navigate({ to: "/orders" })}
            >
              返回
            </Button>
            <Chip label={order.orderNumber} variant="outlined" />
            {(order.status === "pending" || order.status === "confirmed") &&
              order.items.length >= 2 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    navigate({
                      to: "/orders/$orderId/split",
                      params: { orderId },
                    })
                  }
                >
                  分拆訂單
                </Button>
              )}
          </>
        }
      />

      {statusError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setStatusError(null)}
        >
          {statusError}
        </Alert>
      )}

      <Stack spacing={3}>
        <InfoCard
          order={order}
          allowedStatuses={allowedStatuses}
          statusPending={updateStatus.isPending}
          onStatusChange={(status) => void handleStatusChange(status)}
        />
        <OrderItemsCard order={order} />
      </Stack>
    </Box>
  );
}
