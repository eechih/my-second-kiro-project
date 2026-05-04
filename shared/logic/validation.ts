/**
 * 表單驗證規則純函式
 *
 * 各實體（Customer、Supplier、Product、Order）的必填欄位驗證。
 * 驗證失敗時回傳缺少的欄位名稱。
 *
 * 此模組為純函式，前端與 Lambda 共用同一份邏輯（Single Source of Truth）。
 *
 * 需求：1.4, 2.4, 3.4, 4.12
 */

import type { ValidationResult } from "../models/order";

// ---------------------------------------------------------------------------
// 內部工具
// ---------------------------------------------------------------------------

/**
 * 檢查字串值是否為空（undefined、null、空字串或僅含空白）。
 */
function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
}

/**
 * 檢查數值是否為有效的非負數。
 * undefined / null / NaN / 負數皆視為無效。
 */
function isInvalidNonNegativeNumber(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return true;
  }
  return value < 0;
}

/**
 * 檢查數值是否為有效的正數（> 0）。
 */
function isInvalidPositiveNumber(value: unknown): boolean {
  if (isInvalidNonNegativeNumber(value)) {
    return true;
  }
  return (value as number) <= 0;
}

// ---------------------------------------------------------------------------
// Customer 驗證
// ---------------------------------------------------------------------------

/** Customer 必填欄位清單 */
const CUSTOMER_REQUIRED_FIELDS: readonly (readonly [string, string])[] = [
  ["name", "客戶名稱"],
  ["contactPerson", "聯絡人"],
  ["phone", "電話"],
] as const;

/**
 * 驗證客戶資料的必填欄位。
 *
 * @param input - 部分客戶資料（可為 CreateCustomerInput 或 UpdateCustomerInput 的欄位子集）
 * @returns 驗證結果。若失敗，error 包含所有缺少的欄位名稱。
 */
export function validateCustomer(
  input: Record<string, unknown>,
): ValidationResult {
  const missing: string[] = [];

  for (const [field, label] of CUSTOMER_REQUIRED_FIELDS) {
    if (isBlank(input[field])) {
      missing.push(label);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必填欄位：${missing.join("、")}`,
    };
  }

  return { valid: true };
}

/**
 * 取得客戶資料中缺少的必填欄位名稱列表。
 *
 * @param input - 部分客戶資料
 * @returns 缺少的欄位名稱陣列（空陣列表示全部通過）
 */
export function getMissingCustomerFields(
  input: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const [field, label] of CUSTOMER_REQUIRED_FIELDS) {
    if (isBlank(input[field])) {
      missing.push(label);
    }
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Supplier 驗證
// ---------------------------------------------------------------------------

/** Supplier 必填欄位清單 */
const SUPPLIER_REQUIRED_FIELDS: readonly (readonly [string, string])[] = [
  ["name", "供應商名稱"],
  ["contactPerson", "聯絡人"],
  ["phone", "電話"],
] as const;

/**
 * 驗證供應商資料的必填欄位。
 *
 * @param input - 部分供應商資料
 * @returns 驗證結果。若失敗，error 包含所有缺少的欄位名稱。
 */
export function validateSupplier(
  input: Record<string, unknown>,
): ValidationResult {
  const missing: string[] = [];

  for (const [field, label] of SUPPLIER_REQUIRED_FIELDS) {
    if (isBlank(input[field])) {
      missing.push(label);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必填欄位：${missing.join("、")}`,
    };
  }

  return { valid: true };
}

/**
 * 取得供應商資料中缺少的必填欄位名稱列表。
 *
 * @param input - 部分供應商資料
 * @returns 缺少的欄位名稱陣列
 */
export function getMissingSupplierFields(
  input: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const [field, label] of SUPPLIER_REQUIRED_FIELDS) {
    if (isBlank(input[field])) {
      missing.push(label);
    }
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Product 驗證
// ---------------------------------------------------------------------------

/** Product 必填字串欄位清單 */
const PRODUCT_REQUIRED_STRING_FIELDS: readonly (readonly [string, string])[] = [
  ["name", "商品名稱"],
  ["sku", "SKU"],
] as const;

/** Product 必填數值欄位清單（非負數） */
const PRODUCT_REQUIRED_NUMBER_FIELDS: readonly (readonly [string, string])[] = [
  ["unitPrice", "單價"],
  ["defaultCost", "進貨成本"],
] as const;

/**
 * 驗證商品資料的必填欄位。
 *
 * 字串欄位（name、sku）不可為空。
 * 數值欄位（unitPrice、defaultCost）必須為有效的非負數。
 *
 * @param input - 部分商品資料
 * @returns 驗證結果。若失敗，error 包含所有缺少或無效的欄位名稱。
 */
export function validateProduct(
  input: Record<string, unknown>,
): ValidationResult {
  const missing: string[] = [];

  for (const [field, label] of PRODUCT_REQUIRED_STRING_FIELDS) {
    if (isBlank(input[field])) {
      missing.push(label);
    }
  }

  for (const [field, label] of PRODUCT_REQUIRED_NUMBER_FIELDS) {
    if (isInvalidNonNegativeNumber(input[field])) {
      missing.push(label);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必填欄位：${missing.join("、")}`,
    };
  }

  return { valid: true };
}

/**
 * 取得商品資料中缺少或無效的必填欄位名稱列表。
 *
 * @param input - 部分商品資料
 * @returns 缺少的欄位名稱陣列
 */
export function getMissingProductFields(
  input: Record<string, unknown>,
): string[] {
  const missing: string[] = [];

  for (const [field, label] of PRODUCT_REQUIRED_STRING_FIELDS) {
    if (isBlank(input[field])) {
      missing.push(label);
    }
  }

  for (const [field, label] of PRODUCT_REQUIRED_NUMBER_FIELDS) {
    if (isInvalidNonNegativeNumber(input[field])) {
      missing.push(label);
    }
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Order 驗證
// ---------------------------------------------------------------------------

/**
 * 驗證訂單資料的必填欄位。
 *
 * 規則：
 * - customerId 不可為空
 * - customerName 不可為空
 * - lineItems 必須為非空陣列
 * - 每筆明細項目的 productId、productName 不可為空
 * - 每筆明細項目的 quantity 必須為正數（> 0）
 * - 每筆明細項目的 unitPrice 必須為非負數（>= 0）
 *
 * @param input - 部分訂單資料
 * @returns 驗證結果。若失敗，error 包含所有缺少或無效的欄位名稱。
 */
export function validateOrder(
  input: Record<string, unknown>,
): ValidationResult {
  const missing: string[] = [];

  if (isBlank(input["customerId"])) {
    missing.push("客戶");
  }

  if (isBlank(input["customerName"])) {
    missing.push("客戶名稱");
  }

  const lineItems = input["lineItems"];
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    missing.push("明細項目");
  } else {
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i] as Record<string, unknown> | undefined;
      if (!item) {
        missing.push(`明細項目 ${i + 1}`);
        continue;
      }

      const prefix = `明細項目 ${i + 1}`;

      if (isBlank(item["productId"])) {
        missing.push(`${prefix} 商品`);
      }

      if (isBlank(item["productName"])) {
        missing.push(`${prefix} 商品名稱`);
      }

      if (isInvalidPositiveNumber(item["quantity"])) {
        missing.push(`${prefix} 數量`);
      }

      if (isInvalidNonNegativeNumber(item["unitPrice"])) {
        missing.push(`${prefix} 單價`);
      }
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必填欄位：${missing.join("、")}`,
    };
  }

  return { valid: true };
}

/**
 * 取得訂單資料中缺少或無效的必填欄位名稱列表。
 *
 * @param input - 部分訂單資料
 * @returns 缺少的欄位名稱陣列
 */
export function getMissingOrderFields(
  input: Record<string, unknown>,
): string[] {
  const missing: string[] = [];

  if (isBlank(input["customerId"])) {
    missing.push("客戶");
  }

  if (isBlank(input["customerName"])) {
    missing.push("客戶名稱");
  }

  const lineItems = input["lineItems"];
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    missing.push("明細項目");
  } else {
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i] as Record<string, unknown> | undefined;
      if (!item) {
        missing.push(`明細項目 ${i + 1}`);
        continue;
      }

      const prefix = `明細項目 ${i + 1}`;

      if (isBlank(item["productId"])) {
        missing.push(`${prefix} 商品`);
      }

      if (isBlank(item["productName"])) {
        missing.push(`${prefix} 商品名稱`);
      }

      if (isInvalidPositiveNumber(item["quantity"])) {
        missing.push(`${prefix} 數量`);
      }

      if (isInvalidNonNegativeNumber(item["unitPrice"])) {
        missing.push(`${prefix} 單價`);
      }
    }
  }

  return missing;
}
