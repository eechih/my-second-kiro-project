import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  /** 待處理訂單數量（status = "PENDING"） */
  pendingOrdersCount: number;
  /** 待入庫訂單數量（status = "ORDERED"） */
  pendingProcurementCount: number;
  /** 待出貨訂單數量（status = "RECEIVED"） */
  readyToShipOrderItemsCount: number;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const DASHBOARD_KEYS = {
  all: ["dashboard"] as const,
  summary: () => [...DASHBOARD_KEYS.all, "summary"] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * 儀表板摘要查詢 hook
 *
 * 查詢待處理訂單、待入庫採購記錄、待出貨訂單的摘要數量。
 *
 * 需求：8.3
 */
export function useDashboardSummary(): UseQueryResult<DashboardSummary> {
  return useQuery({
    queryKey: DASHBOARD_KEYS.summary(),
    queryFn: async (): Promise<DashboardSummary> => {
      // 並行查詢三個摘要數量
      const [ordersResult, pendingProcurementResult, readyToShipResult] =
        await Promise.all([
          // 待處理訂單（status = "PENDING"）
          client.models.Order.list({
            filter: { status: { eq: "PENDING" } },
            limit: 1000,
          }),
          // 待入庫訂單（status = "ORDERED"）
          client.models.Order.list({
            filter: { status: { eq: "ORDERED" } },
            limit: 1000,
          }),
          // 待出貨訂單（status = "RECEIVED"）
          client.models.Order.list({
            filter: { status: { eq: "RECEIVED" } },
            limit: 1000,
          }),
        ]);

      return {
        pendingOrdersCount: ordersResult.data?.length ?? 0,
        pendingProcurementCount: pendingProcurementResult.data?.length ?? 0,
        readyToShipOrderItemsCount: readyToShipResult.data?.length ?? 0,
      };
    },
    // 每 30 秒自動重新查詢
    refetchInterval: 30_000,
  });
}

export { DASHBOARD_KEYS };
