import { CursorPagination } from "@/components/CursorPagination";
import { PageHeader } from "@/components/PageHeader";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import {
  useMergeOrders,
  useOrderList,
  type OrderStatusFilter,
} from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { validateMergeOrders } from "@shared/logic/order-merge";
import type { Order } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OrderTable } from "./-components/OrderTable";
import { OrderToolbar } from "./-components/OrderToolbar";

export const Route = createFileRoute("/orders/")({
  beforeLoad: requireAuth,
  component: OrderListPage,
});

function OrderListPage(): React.ReactElement {
  const navigate = useNavigate();
  const pagination = useCursorPagination(10);
  const mergeOrders = useMergeOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadedOrders, setLoadedOrders] = useState<Map<string, Order>>(
    () => new Map(),
  );
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const { data, isLoading } = useOrderList({
    pageSize: pagination.pageSize,
    nextToken: pagination.currentToken,
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const orderIds = useMemo(() => data?.items ?? [], [data?.items]);
  const nextToken = data?.nextToken;

  useEffect(() => {
    const currentOrderIds = new Set(orderIds);
    setSelectedOrderIds((previous) => {
      const next = new Set(
        [...previous].filter((orderId) => currentOrderIds.has(orderId)),
      );
      return next.size === previous.size ? previous : next;
    });
  }, [orderIds]);

  const handleOrderSelectionChange = useCallback(
    (orderId: string, selected: boolean): void => {
      setSelectedOrderIds((previous) => {
        const next = new Set(previous);
        if (selected) {
          next.add(orderId);
        } else {
          next.delete(orderId);
        }
        return next;
      });
    },
    [],
  );

  const handleSelectAllChange = useCallback(
    (selected: boolean): void => {
      setSelectedOrderIds((previous) => {
        const next = new Set(previous);
        for (const orderId of orderIds) {
          if (selected) {
            next.add(orderId);
          } else {
            next.delete(orderId);
          }
        }
        return next;
      });
    },
    [orderIds],
  );

  const handleOrderLoaded = useCallback((order: Order): void => {
    setLoadedOrders((previous) => {
      const current = previous.get(order.id);
      if (
        current &&
        current.status === order.status &&
        current.customerId === order.customerId &&
        current.totalAmount === order.totalAmount &&
        current.updatedAt === order.updatedAt
      ) {
        return previous;
      }

      const next = new Map(previous);
      next.set(order.id, order);
      return next;
    });
  }, []);

  const selectedOrders = useMemo(
    () =>
      [...selectedOrderIds]
        .map((orderId) => loadedOrders.get(orderId))
        .filter((order): order is Order => !!order),
    [loadedOrders, selectedOrderIds],
  );

  const canMergeSelectedOrders =
    selectedOrders.length === selectedOrderIds.size &&
    validateMergeOrders(selectedOrders).valid;
  const selectedOrderTotalAmount = selectedOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );
  const selectedOrderLineItemCount = selectedOrders.reduce(
    (sum, order) => sum + order.lineItems.length,
    0,
  );

  const handleEdit = useCallback(
    (orderId: string): void => {
      void navigate({
        to: "/orders/$orderId" as string,
        params: { orderId } as Record<string, string>,
      });
    },
    [navigate],
  );

  const handleMergeClick = useCallback((): void => {
    const validation = validateMergeOrders(selectedOrders);
    if (!validation.valid) {
      setMergeError(validation.error ?? "選取的訂單無法合併");
      return;
    }

    setMergeError(null);
    setMergeDialogOpen(true);
  }, [selectedOrders]);

  const handleConfirmMerge = useCallback(async (): Promise<void> => {
    setMergeError(null);

    try {
      const result = await mergeOrders.mutateAsync({
        orderIds: selectedOrders.map((order) => order.id),
      });
      setMergeDialogOpen(false);
      setSelectedOrderIds(new Set());
      void navigate({
        to: "/orders/$orderId" as string,
        params: { orderId: result.id } as Record<string, string>,
      });
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "合併訂單失敗");
    }
  }, [mergeOrders, navigate, selectedOrders]);

  return (
    <Box>
      <PageHeader section="訂單" current="列表" title="列表" />

      {mergeError && !mergeDialogOpen && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMergeError(null)}>
          {mergeError}
        </Alert>
      )}

      <OrderToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          pagination.reset();
        }}
        totalCount={data?.totalCount ?? 0}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value);
          pagination.reset();
        }}
        mergeDisabled={!canMergeSelectedOrders}
        onMergeClick={handleMergeClick}
        onAddClick={() => navigate({ to: "/orders/new" })}
      />

      <OrderTable
        orderIds={orderIds}
        isLoading={isLoading}
        selectedOrderIds={selectedOrderIds}
        onEdit={handleEdit}
        onSelectionChange={handleOrderSelectionChange}
        onSelectAllChange={handleSelectAllChange}
        onOrderLoaded={handleOrderLoaded}
      />

      <CursorPagination
        pageSize={pagination.pageSize}
        onPageSizeChange={pagination.setPageSize}
        hasNextPage={!!nextToken}
        hasPrevPage={pagination.tokenStack.length > 0}
        onNextPage={() => {
          if (nextToken) pagination.goNext(nextToken);
        }}
        onPrevPage={pagination.goPrev}
        currentCount={orderIds.length}
      />

      <Dialog
        open={mergeDialogOpen}
        onClose={() => {
          if (!mergeOrders.isPending) {
            setMergeDialogOpen(false);
            setMergeError(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>合併訂單</DialogTitle>
        <DialogContent>
          {mergeError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setMergeError(null)}
            >
              {mergeError}
            </Alert>
          )}

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            已選取合併的訂單
          </Typography>
          <Box sx={{ display: "grid", gap: 1, mb: 2 }}>
            {selectedOrders.map((order) => (
              <Box
                key={order.id}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="body2">{order.orderNumber}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {order.customerName}
                  </Typography>
                </Box>
                <Typography variant="body2">
                  ${order.totalAmount.toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            合併預覽資訊
          </Typography>
          <Box sx={{ display: "grid", gap: 1 }}>
            <Typography variant="body2">
              選取訂單數：{selectedOrders.length} 筆
            </Typography>
            <Typography variant="body2">
              合併後明細項目數：{selectedOrderLineItemCount} 項
            </Typography>
            <Typography variant="body2">
              合併後總金額：${selectedOrderTotalAmount.toLocaleString()}
            </Typography>
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            合併後，來源訂單將被取消，並建立一筆包含所有明細項目的新訂單。
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            color="inherit"
            disabled={mergeOrders.isPending}
            onClick={() => {
              setMergeDialogOpen(false);
              setMergeError(null);
            }}
          >
            取消
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmMerge()}
            disabled={mergeOrders.isPending}
            startIcon={
              mergeOrders.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
          >
            {mergeOrders.isPending ? "合併中..." : "確認合併"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
