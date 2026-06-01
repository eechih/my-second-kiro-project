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
import { validateMergeOrders } from "@shared/logic/order-merge";
import type { Order } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MergeDialog } from "./-components/merge/Dialog";
import { OrderTable } from "./-components/list/OrderTable";
import { Toolbar } from "./-components/list/Toolbar";
import { printPackingSlips } from "./-components/list/packingSlip";

export const Route = createFileRoute("/orders/")({
  beforeLoad: requireAuth,
  component: OrderListPage,
});

function OrderListPage(): React.ReactElement {
  const navigate = useNavigate();
  const pagination = useCursorPagination(25);
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
  const [printError, setPrintError] = useState<string | null>(null);

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
  const canPrintSelectedOrders =
    selectedOrders.length > 0 && selectedOrders.length === selectedOrderIds.size;
  const selectedOrderTotalAmount = selectedOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );
  const selectedOrderItemCount = selectedOrders.reduce(
    (sum, order) => sum + order.items.length,
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

  const handlePrintClick = useCallback((): void => {
    if (!canPrintSelectedOrders) {
      setPrintError("請先選取已載入完成的訂單");
      return;
    }

    setPrintError(null);
    const opened = printPackingSlips(selectedOrders);
    if (!opened) {
      setPrintError("無法開啟列印視窗，請允許瀏覽器彈出視窗後再試一次");
    }
  }, [canPrintSelectedOrders, selectedOrders]);

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

      {printError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPrintError(null)}>
          {printError}
        </Alert>
      )}

      <Toolbar
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
        printDisabled={!canPrintSelectedOrders}
        onPrintClick={handlePrintClick}
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

      <MergeDialog
        open={mergeDialogOpen}
        orders={selectedOrders}
        totalAmount={selectedOrderTotalAmount}
        orderItemCount={selectedOrderItemCount}
        error={mergeError}
        isPending={mergeOrders.isPending}
        onClose={() => {
          if (!mergeOrders.isPending) {
            setMergeDialogOpen(false);
            setMergeError(null);
          }
        }}
        onClearError={() => setMergeError(null)}
        onConfirm={() => void handleConfirmMerge()}
      />
    </Box>
  );
}
