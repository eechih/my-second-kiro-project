import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { client } from "@/lib/amplify-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  /** 待處理訂單數量（status = "pending"） */
  pendingOrdersCount: number;
  /** 待入庫明細數量（status = "ordered"） */
  pendingProcurementCount: number;
  /** 待出貨明細數量（status = "received"） */
  readyToShipLineItemsCount: number;
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
 * 查詢待處理訂單、待入庫採購記錄、待出貨明細的摘要數量。
 *
 * 需求：8.3
 */
export function useDashboardSummary(): UseQueryResult<DashboardSummary> {
  return useQuery({
    queryKey: DASHBOARD_KEYS.summary(),
    queryFn: async (): Promise<DashboardSummary> => {
      // 並行查詢三個摘要數量
      const [ordersResult, pendingProcurementResult, lineItemsResult] =
        await Promise.all([
          // 待處理訂單（status = "pending"）
          client.models.Order.list({
            filter: { status: { eq: "pending" } },
            limit: 1000,
          }),
          // 待入庫明細（status = "ordered"）
          client.models.LineItem.list({
            filter: { status: { eq: "ordered" } },
            limit: 1000,
          }),
          // 待出貨明細（status = "received"）
          client.models.LineItem.list({
            filter: { status: { eq: "received" } },
            limit: 1000,
          }),
        ]);

      return {
        pendingOrdersCount: ordersResult.data?.length ?? 0,
        pendingProcurementCount: pendingProcurementResult.data?.length ?? 0,
        readyToShipLineItemsCount: lineItemsResult.data?.length ?? 0,
      };
    },
    // 每 30 秒自動重新查詢
    refetchInterval: 30_000,
  });
}

export { DASHBOARD_KEYS };
