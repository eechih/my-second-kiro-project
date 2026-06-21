import type { Schema } from "../../data/resource";

/**
 * 確認出貨（含庫存驗證與扣減）Lambda 函式（placeholder）
 *
 * 實際邏輯將於後續 Task 實作。
 */
export const handler: Schema["confirmShipmentDispatch"]["functionHandler"] =
  async (event) => {
    const { shipmentId } = event.arguments;
    return JSON.stringify({
      success: false,
      message: "尚未實作",
      data: { shipmentId },
    });
  };
