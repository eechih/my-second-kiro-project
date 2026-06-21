import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { useMergeOrders, useOrderList } from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { Order } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

/** 簡易合併驗證（order-merge 模組已移除） */
function validateMergeOrders(orders: Order[]): { valid: boolean; error?: string } {
  if (orders.length < 2) return { valid: false, error: "至少需選取 2 筆訂單" };
  const firstCustomerId = orders[0]?.customerId;
  if (!orders.every((o) => o.customerId === firstCustomerId)) {
    return { valid: false, error: "所有訂單必須屬於同一客戶" };
  }
  if (!orders.every((o) => o.status === "PENDING" || o.status === "ORDERED")) {
    return { valid: false, error: "所有訂單狀態必須為「待處理」或「已採購」" };
  }
  return { valid: true };
}
import { useCallback, useMemo, useState } from "react";
import {
  MergeCustomerSection,
  type CustomerOption,
} from "./-components/merge/CustomerSection";
import { MergePreview } from "./-components/merge/Preview";
import { MergeSelectionTable } from "./-components/merge/SelectionTable";

export const Route = createFileRoute("/orders/merge")({
  beforeLoad: requireAuth,
  component: OrderMergePage,
});

function OrderMergePage() {
  const navigate = useNavigate();
  const mergeOrders = useMergeOrders();

  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadedOrders, setLoadedOrders] = useState<Map<string, Order>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // 查詢選定客戶的可合併訂單
  const { data: ordersData, isLoading: orderIdsLoading } = useOrderList({
    pageSize: 100,
    search: selectedCustomer?.name,
  });
  const orderIds = useMemo(() => ordersData?.items ?? [], [ordersData?.items]);

  // 篩選出屬於選定客戶且尚未進入出貨流程的待處理/已採購訂單
  const mergeableOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return orderIds
      .map((orderId) => loadedOrders.get(orderId))
      .filter((order): order is Order => !!order)
      .filter(
        (order) =>
          order.customerId === selectedCustomer.id &&
          (order.status === "PENDING" || order.status === "ORDERED"),
      );
  }, [selectedCustomer, orderIds, loadedOrders]);

  const ordersLoading =
    orderIdsLoading ||
    (orderIds.length > 0 && loadedOrders.size < orderIds.length);

  const handleOrderLoaded = useCallback((order: Order): void => {
    setLoadedOrders((prev) => {
      const current = prev.get(order.id);
      if (
        current &&
        current.status === order.status &&
        current.totalAmount === order.totalAmount &&
        current.updatedAt === order.updatedAt
      ) {
        return prev;
      }

      const next = new Map(prev);
      next.set(order.id, order);
      return next;
    });
  }, []);

  // 切換訂單選取
  const toggleOrderSelection = (orderId: string): void => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
    setError(null);
  };

  // 全選/取消全選
  const toggleSelectAll = (): void => {
    if (selectedOrderIds.size === mergeableOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(mergeableOrders.map((o) => o.id)));
    }
    setError(null);
  };

  // 取得選取的訂單物件
  const selectedOrders = useMemo(
    () => mergeableOrders.filter((o) => selectedOrderIds.has(o.id)),
    [mergeableOrders, selectedOrderIds],
  );

  // 合併前驗證
  const handleMergeClick = (): void => {
    const validation = validateMergeOrders(selectedOrders);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }
    setShowConfirm(true);
  };

  // 執行合併
  const handleConfirmMerge = async (): Promise<void> => {
    setShowConfirm(false);
    setError(null);

    try {
      const result = await mergeOrders.mutateAsync({
        orderIds: Array.from(selectedOrderIds),
      });
      // 導向新訂單詳情頁面
      void navigate({
        to: "/orders/$orderId" as string,
        params: { orderId: result.id } as Record<string, string>,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "合併訂單失敗");
    }
  };

  // 計算合併後總金額
  const totalMergedAmount = selectedOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );
  const totalOrderItemCount = selectedOrders.length;

  return (
    <Box>
      <PageHeader
        section="訂單"
        current="合併"
        title="合併訂單"
        actions={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate({ to: "/orders", search: { customerId: undefined, customerName: undefined } })}
          >
            返回
          </Button>
        }
      />

      {/* 錯誤訊息 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <MergeCustomerSection
        selectedCustomer={selectedCustomer}
        onCustomerChange={(customer) => {
          setSelectedCustomer(customer);
          setSelectedOrderIds(new Set());
          setLoadedOrders(new Map());
          setError(null);
        }}
      />

      {selectedCustomer && (
        <MergeSelectionTable
          orderIds={orderIds}
          selectedOrderIds={selectedOrderIds}
          selectedCustomerId={selectedCustomer.id}
          mergeableOrderCount={mergeableOrders.length}
          orderIdsLoading={orderIdsLoading}
          ordersLoading={ordersLoading}
          onToggleOrder={toggleOrderSelection}
          onToggleSelectAll={toggleSelectAll}
          onOrderLoaded={handleOrderLoaded}
        />
      )}

      <MergePreview
        selectedOrderCount={selectedOrderIds.size}
        totalAmount={totalMergedAmount}
        orderItemCount={totalOrderItemCount}
        isPending={mergeOrders.isPending}
        onMerge={handleMergeClick}
      />

      {/* 確認對話框 */}
      <ConfirmDialog
        open={showConfirm}
        title="確認合併訂單"
        message={`確定要將 ${selectedOrderIds.size} 筆訂單合併為一筆新訂單嗎？來源訂單將被取消，此操作無法復原。`}
        onConfirm={() => void handleConfirmMerge()}
        onCancel={() => setShowConfirm(false)}
      />
    </Box>
  );
}
