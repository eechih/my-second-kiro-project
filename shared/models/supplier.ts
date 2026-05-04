/**
 * 供應商（Supplier）資料模型
 *
 * 需求：2.1, 2.2, 2.3
 */

/** 供應商基本資料 */
export interface Supplier {
  /** 唯一識別碼 */
  id: string;
  /** 供應商名稱（必填） */
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

/** 建立供應商輸入 */
export interface CreateSupplierInput {
  /** 供應商名稱（必填） */
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

/** 更新供應商輸入 */
export interface UpdateSupplierInput {
  /** 供應商 ID（必填） */
  id: string;
  /** 供應商名稱 */
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
