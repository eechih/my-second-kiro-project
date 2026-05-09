import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { useOrder, useSplitOrder } from "@/hooks/useOrders";
import { requireAuth } from "@/lib/route-guards";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import { calculateOrderTotal } from "@shared/logic/order-calculations";
import { validateSplitOrder } from "@shared/logic/order-split";
import type { LineItem, SplitAllocation } from "@shared/models";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SplitActions } from "./-components/split/Actions";
import { SplitAllocationTable } from "./-components/split/AllocationTable";
import { SplitInfoCard } from "./-components/split/InfoCard";
import {
  SplitPreview,
  type SplitPreviewGroup,
} from "./-components/split/Preview";

export const Route = createFileRoute("/orders/$orderId/split")({
  beforeLoad: requireAuth,
  component: OrderSplitPage,
});

function OrderSplitPage() {
  const navigate = useNavigate();
  const { orderId } = Route.useParams();
  const { data: order, isLoading } = useOrder(orderId);
  const splitOrder = useSplitOrder();

  // 每個明細項目分配到哪筆新訂單（0-based index）
  const [allocations, setAllocations] = useState<Map<string, number>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // 可用的新訂單數量（最多等於明細項目數量，最少 2）
  const maxNewOrders = Math.max(order?.lineItems.length ?? 2, 2);

  // 更新分配
  const handleAllocationChange = (
    lineItemId: string,
    targetIndex: number,
  ): void => {
    setAllocations((prev) => {
      const next = new Map(prev);
      next.set(lineItemId, targetIndex);
      return next;
    });
    setError(null);
  };

  // 建立 SplitAllocation 陣列
  const splitAllocations: SplitAllocation[] = useMemo(() => {
    return Array.from(allocations.entries()).map(
      ([lineItemId, targetOrderIndex]) => ({
        lineItemId,
        targetOrderIndex,
      }),
    );
  }, [allocations]);

  // 分拆預覽：依 targetOrderIndex 分組
  const splitPreview = useMemo<SplitPreviewGroup[]>(() => {
    if (!order) return [];

    const groups = new Map<number, LineItem[]>();
    for (const [lineItemId, targetIndex] of allocations.entries()) {
      const lineItem = order.lineItems.find((li) => li.id === lineItemId);
      if (lineItem) {
        const group = groups.get(targetIndex);
        if (group) {
          group.push(lineItem);
        } else {
          groups.set(targetIndex, [lineItem]);
        }
      }
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([index, lineItems]) => ({
        index,
        lineItems,
        totalAmount: calculateOrderTotal(lineItems),
      }));
  }, [order, allocations]);

  // 已使用的新訂單索引數量
  const usedOrderIndices = new Set(allocations.values());

  // 驗證並顯示確認對話框
  const handleSplitClick = (): void => {
    if (!order) return;

    const validation = validateSplitOrder(order, splitAllocations);
    if (!validation.valid) {
      setError(validation.error ?? "驗證失敗");
      return;
    }
    setShowConfirm(true);
  };

  // 執行分拆
  const handleConfirmSplit = async (): Promise<void> => {
    setShowConfirm(false);
    setError(null);

    try {
      await splitOrder.mutateAsync({
        orderId,
        allocations: splitAllocations,
      });
      // 導向訂單列表頁面
      void navigate({ to: "/orders" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "分拆訂單失敗");
    }
  };

  // 載入中
  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  // 訂單不存在
  if (!order) {
    return (
      <Box>
        <Alert severity="error">找不到該訂單</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate({ to: "/orders" })}
          sx={{ mt: 2 }}
        >
          返回訂單列表
        </Button>
      </Box>
    );
  }

  // 檢查訂單是否可分拆
  const canSplit = order.status === "pending" || order.status === "confirmed";

  return (
    <Box>
      <PageHeader
        section="訂單"
        current="分拆"
        title="分拆訂單"
        actions={
          <>
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
            <Chip label={order.orderNumber} variant="outlined" />
          </>
        }
      />

      {/* 錯誤訊息 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 不可分拆提示 */}
      {!canSplit && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          僅能分拆狀態為「待處理」或「已確認」的訂單。目前訂單狀態為「
          {order.status}」。
        </Alert>
      )}

      <SplitInfoCard order={order} />

      {/* 明細分配 */}
      {canSplit && (
        <SplitAllocationTable
          order={order}
          allocations={allocations}
          maxNewOrders={maxNewOrders}
          onAllocationChange={handleAllocationChange}
        />
      )}

      {canSplit && (
        <SplitPreview
          groups={splitPreview}
          newOrderCount={usedOrderIndices.size}
        />
      )}

      {canSplit && (
        <SplitActions
          isPending={splitOrder.isPending}
          disabled={
            splitOrder.isPending ||
            allocations.size !== order.lineItems.length ||
            usedOrderIndices.size < 2
          }
          onConfirm={handleSplitClick}
          onCancel={() =>
            navigate({
              to: "/orders/$orderId" as string,
              params: { orderId } as Record<string, string>,
            })
          }
        />
      )}

      {/* 確認對話框 */}
      <ConfirmDialog
        open={showConfirm}
        title="確認分拆訂單"
        message={`確定要將此訂單分拆為 ${usedOrderIndices.size} 筆新訂單嗎？原訂單將被取消，此操作無法復原。`}
        onConfirm={() => void handleConfirmSplit()}
        onCancel={() => setShowConfirm(false)}
      />
    </Box>
  );
}
