/**
 * 客戶（Customer）資料模型
 *
 * 需求：1.1, 1.2, 1.3
 */

/** 客戶基本資料 */
export interface Customer {
  /** 唯一識別碼 */
  id: string;
  /** 客戶名稱（必填） */
  name: string;
  /** 聯絡人（必填） */
  contactPerson: string;
  /** 電話（必填） */
  phone: string;
  /** Email（選填） */
  email: string;
  /** 地址（選填） */
  address: string;
  /** 啟用狀態（預設 true，false 表示已停用） */
  isActive: boolean;
  /** ISO 8601 建立時間 */
  createdAt: string;
  /** ISO 8601 更新時間 */
  updatedAt: string;
}

/** 建立客戶輸入 */
export interface CreateCustomerInput {
  /** 客戶名稱（必填） */
  name: string;
  /** 聯絡人（必填） */
  contactPerson: string;
  /** 電話（必填） */
  phone: string;
  /** Email（選填） */
  email?: string;
  /** 地址（選填） */
  address?: string;
}

/** 更新客戶輸入 */
export interface UpdateCustomerInput {
  /** 客戶 ID（必填） */
  id: string;
  /** 客戶名稱 */
  name?: string;
  /** 聯絡人 */
  contactPerson?: string;
  /** 電話 */
  phone?: string;
  /** Email */
  email?: string;
  /** 地址 */
  address?: string;
}
