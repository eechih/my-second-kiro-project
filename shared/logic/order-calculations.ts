/**
 * 訂單金額計算與欄位驗證
 *
 * 提供單筆 Order 金額計算函式與欄位範圍驗證。
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：1.2, 1.3, 1.4, 1.5, 1.7, 1.8
 */

// ---------------------------------------------------------------------------
// 金額計算
// ---------------------------------------------------------------------------

/**
 * 計算總價 = quantity × unitPrice
 */
export function calculateTotalPrice(
  quantity: number,
  unitPrice: number,
): number {
  return quantity * unitPrice;
}

/**
 * 計算總成本 = quantity × unitCost（null-safe：unitCost 為 null 時回傳 null）
 */
export function calculateTotalCost(
  quantity: number,
  unitCost: number | null,
): number | null {
  if (unitCost === null) {
    return null;
  }
  return quantity * unitCost;
}

/**
 * 計算訂單總金額 = subtotal + shipping - discount
 */
export function calculateTotalAmount(
  subtotal: number,
  shipping: number,
  discount: number,
): number {
  return subtotal + shipping - discount;
}

// ---------------------------------------------------------------------------
// 欄位驗證
// ---------------------------------------------------------------------------

/** 驗證函式輸入 */
export interface OrderFieldsInput {
  quantity: number;
  unitPriceSnapshot: number;
  unitCostSnapshot?: number | null;
  shippingAmount: number;
  discountAmount: number;
  subtotalAmount?: number; // needed to check discountAmount ≤ subtotalAmount + shippingAmount
}

/** 驗證結果 */
export interface OrderFieldValidationResult {
  valid: boolean;
  errors: string[]; // Array of error messages in Traditional Chinese
}

/**
 * 驗證 Order 欄位值範圍
 * - quantity: 1–9999
 * - unitPriceSnapshot: 0–999,999,999
 * - unitCostSnapshot: 0–999,999,999 (when not null)
 * - shippingAmount: 0–999,999,999
 * - discountAmount: 0–999,999,999 AND discountAmount ≤ subtotalAmount + shippingAmount
 *
 * 所有值必須為整數，非整數值也會被拒絕。
 */
export function validateOrderFields(
  input: OrderFieldsInput,
): OrderFieldValidationResult {
  const errors: string[] = [];

  // quantity: 必須是整數，且範圍 1–9999
  if (!Number.isInteger(input.quantity)) {
    errors.push(`「數量」欄位值 ${input.quantity} 超出允許範圍 (1–9999)`);
  } else if (input.quantity < 1 || input.quantity > 9999) {
    errors.push(`「數量」欄位值 ${input.quantity} 超出允許範圍 (1–9999)`);
  }

  // unitPriceSnapshot: 必須是整數，且範圍 0–999,999,999
  if (!Number.isInteger(input.unitPriceSnapshot)) {
    errors.push(
      `「單價」欄位值 ${input.unitPriceSnapshot} 超出允許範圍 (0–999,999,999)`,
    );
  } else if (
    input.unitPriceSnapshot < 0 ||
    input.unitPriceSnapshot > 999_999_999
  ) {
    errors.push(
      `「單價」欄位值 ${input.unitPriceSnapshot} 超出允許範圍 (0–999,999,999)`,
    );
  }

  // unitCostSnapshot: 必須是整數，且範圍 0–999,999,999（when not null）
  if (input.unitCostSnapshot !== undefined && input.unitCostSnapshot !== null) {
    if (!Number.isInteger(input.unitCostSnapshot)) {
      errors.push(
        `「成本」欄位值 ${input.unitCostSnapshot} 超出允許範圍 (0–999,999,999)`,
      );
    } else if (
      input.unitCostSnapshot < 0 ||
      input.unitCostSnapshot > 999_999_999
    ) {
      errors.push(
        `「成本」欄位值 ${input.unitCostSnapshot} 超出允許範圍 (0–999,999,999)`,
      );
    }
  }

  // shippingAmount: 必須是整數，且範圍 0–999,999,999
  if (!Number.isInteger(input.shippingAmount)) {
    errors.push(
      `「運費」欄位值 ${input.shippingAmount} 超出允許範圍 (0–999,999,999)`,
    );
  } else if (input.shippingAmount < 0 || input.shippingAmount > 999_999_999) {
    errors.push(
      `「運費」欄位值 ${input.shippingAmount} 超出允許範圍 (0–999,999,999)`,
    );
  }

  // discountAmount: 必須是整數，且範圍 0–999,999,999
  if (!Number.isInteger(input.discountAmount)) {
    errors.push(
      `「折扣金額」欄位值 ${input.discountAmount} 超出允許範圍 (0–999,999,999)`,
    );
  } else if (input.discountAmount < 0 || input.discountAmount > 999_999_999) {
    errors.push(
      `「折扣金額」欄位值 ${input.discountAmount} 超出允許範圍 (0–999,999,999)`,
    );
  } else if (
    input.subtotalAmount !== undefined &&
    Number.isInteger(input.shippingAmount) &&
    input.shippingAmount >= 0
  ) {
    // discountAmount 不得大於 subtotalAmount + shippingAmount
    if (input.discountAmount > input.subtotalAmount + input.shippingAmount) {
      errors.push(`「折扣金額」不得大於小計加運費之和`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
