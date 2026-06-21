import type { Schema } from "../../data/resource";

/**
 * 從 Shipment 移除 Order Lambda 函式（placeholder）
 *
 * 實際邏輯將於後續 Task 實作。
 */
export const handler: Schema["removeOrderFromShipment"]["functionHandler"] =
  async (event) => {
    const { shipmentId, orderId } = event.arguments;
    return JSON.stringify({
      success: false,
      message: "尚未實作",
      data: { shipmentId, orderId },
    });
  };
