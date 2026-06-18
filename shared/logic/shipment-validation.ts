/**
 * 出貨單驗證邏輯
 *
 * 需求：4.4, 4.5, 4.6, 4.7, 6.4, 6.5, 7.1, 7.2
 */

import type { Order, ValidationResult } from "../models/order";
import { ORDER_FULFILLMENT_STATUS_LABEL } from "../models/order";
import type { ShipmentStatus } from "../models/shipment";

/**
 * 驗證所有 Order 狀態為 RECEIVED
 *
 * @param orders - 要驗證的訂單陣列
 * @returns 驗證結果；若有任何訂單狀態非 RECEIVED 則回傳第一筆失敗的錯誤訊息
 */
export function validateOrdersForShipment(orders: Order[]): ValidationResult {
  for (const order of orders) {
    if (order.status !== "RECEIVED") {
      const statusLabel = ORDER_FULFILLMENT_STATUS_LABEL[order.status];
      return {
        valid: false,
        error: `訂單 ${order.orderNumber} 目前狀態為「${statusLabel}」，無法加入出貨單`,
      };
    }
  }
  return { valid: true };
}

/**
 * 以 Product 層級彙總出貨數量並驗證庫存
 *
 * @param orders - 包含 productId、productNameSnapshot、quantity 的訂單資訊陣列
 * @param products - 包含 id、stockQuantity 的商品庫存資訊陣列
 * @returns 驗證結果；若有任何商品庫存不足則回傳第一筆不足的錯誤訊息
 */
export function validateShipmentInventory(
  orders: Array<{
    productId: string;
    productNameSnapshot: string;
    quantity: number;
  }>,
  products: Array<{ id: string; stockQuantity: number }>,
): ValidationResult {
  // 依 productId 彙總數量
  const quantityByProduct = new Map<
    string,
    { productName: string; totalQuantity: number }
  >();

  for (const order of orders) {
    const existing = quantityByProduct.get(order.productId);
    if (existing) {
      existing.totalQuantity += order.quantity;
    } else {
      quantityByProduct.set(order.productId, {
        productName: order.productNameSnapshot,
        totalQuantity: order.quantity,
      });
    }
  }

  // 建立商品庫存查詢 Map
  const stockByProduct = new Map<string, number>();
  for (const product of products) {
    stockByProduct.set(product.id, product.stockQuantity);
  }

  // 驗證每個商品庫存是否足夠
  for (const [productId, { productName, totalQuantity }] of quantityByProduct) {
    const stock = stockByProduct.get(productId) ?? 0;
    if (totalQuantity > stock) {
      return {
        valid: false,
        error: `庫存不足，無法出貨：${productName}（需要 ${totalQuantity}，目前庫存 ${stock}）`,
      };
    }
  }

  return { valid: true };
}

/**
 * 驗證 Order 未關聯至未取消的 Shipment
 *
 * @param order - 包含 orderNumber 與 shipmentId 的訂單資訊
 * @param shipment - 關聯的出貨單資訊（可為 null）
 * @returns 驗證結果；若已關聯至未取消的出貨單則回傳錯誤訊息
 */
export function validateOrderNotInActiveShipment(
  order: { orderNumber: string; shipmentId: string | null },
  shipment: { shipmentNumber: string; status: ShipmentStatus } | null,
): ValidationResult {
  if (
    order.shipmentId !== null &&
    shipment !== null &&
    shipment.status !== "CANCELLED"
  ) {
    return {
      valid: false,
      error: `訂單 ${order.orderNumber} 已關聯至出貨單 ${shipment.shipmentNumber}，無法重複關聯`,
    };
  }
  return { valid: true };
}

/**
 * 驗證出貨單包含的訂單數量在 1–50 筆範圍內
 *
 * @param count - 訂單數量
 * @returns 驗證結果；若數量超出範圍則回傳錯誤訊息
 */
export function validateShipmentOrderCount(count: number): ValidationResult {
  if (count < 1) {
    return {
      valid: false,
      error: "建立出貨單需至少包含一筆狀態為「已到貨」的訂單",
    };
  }
  if (count > 50) {
    return {
      valid: false,
      error: "出貨單最多包含 50 筆訂單",
    };
  }
  return { valid: true };
}
