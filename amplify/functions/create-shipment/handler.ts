import type { Schema } from "../../data/resource";

/**
 * 建立出貨單 Lambda 函式（placeholder）
 *
 * 實際邏輯將於後續 Task 實作。
 */
export const handler: Schema["createShipment"]["functionHandler"] = async (
  event,
) => {
  const { recipientName, orderIds } = event.arguments;
  return JSON.stringify({
    success: false,
    message: "尚未實作",
    data: { recipientName, orderIds },
  });
};
