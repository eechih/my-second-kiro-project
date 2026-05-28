/**
 * 商品（Product）、規格選項（ProductOption / ProductOptionValue / ProductVariant）資料模型
 *
 * 需求：3.1, 3.2, 3.3, 3.9, 3.10, 3.12, 3.13, 3.14, 3.15
 */

/** 商品規格值（如「紅色」、「XL」） */
export interface ProductOptionValue {
  id: string;
  name: string;
  priceOffset: number;
  costOffset: number;
  sortOrder: number;
}

/** 商品規格維度（如「顏色」、「尺寸」） */
export interface ProductOption {
  id: string;
  name: string;
  sortOrder: number;
  values: ProductOptionValue[];
}

/** 商品規格選項（如「黑」、「L」、「黑 L」） */
export interface ProductVariant {
  /** 唯一識別碼 */
  id: string;
  /** 規格顯示標籤（如「黑」、「L」、「黑 L」） */
  label: string;
  /** 單價偏移量（null 或 0 表示沿用商品預設單價，正值加價、負值減價） */
  priceOffset: number | null;
  /** 成本偏移量（null 或 0 表示沿用商品預設成本，正值加價、負值減價） */
  costOffset: number | null;
}

/** 商品基本資料 */
export interface Product {
  /** 唯一識別碼 */
  id: string;
  /** 商品名稱（必填） */
  name: string;
  /** SKU 編號（必填，唯一） */
  sku: string;
  /** 產品描述（選填） */
  description: string;
  /** 預設單價（必填，>= 0） */
  price: number;
  /** 預設進貨成本（必填，>= 0） */
  cost: number;
  /** 預設供應商 ID（選填） */
  defaultSupplierId: string | null;
  /** 庫存數量（>= 0，無規格組合時使用此欄位追蹤庫存） */
  stockQuantity: number;
  /** 規格維度與規格值列表 */
  options: ProductOption[];
  /** 規格選項列表 */
  variants: ProductVariant[];
  /** 商品照片 S3 key 列表（存放於 product-images/{productId}/ 路徑下） */
  imageUrls: string[];
  /** 啟用狀態（預設 true，false 表示已停用） */
  isActive: boolean;
  /** ISO 8601 建立時間 */
  createdAt: string;
  /** ISO 8601 更新時間 */
  updatedAt: string;
}

/** 建立商品輸入 */
export interface CreateProductInput {
  /** 商品名稱（必填） */
  name: string;
  /** SKU 編號（由系統自動產生） */
  sku?: string;
  /** 產品描述（選填） */
  description?: string;
  /** 預設單價（必填，>= 0） */
  price: number;
  /** 預設進貨成本（必填，>= 0） */
  cost: number;
  /** 預設供應商 ID（選填） */
  defaultSupplierId?: string | null;
  /** 初始庫存數量（選填，預設 0） */
  stockQuantity?: number;
  /** 商品照片 S3 key 列表（選填） */
  imageUrls?: string[];
}

export interface CreateProductOptionValueInput {
  name: string;
  priceOffset?: number;
  costOffset?: number;
  sortOrder?: number;
}

export interface CreateProductOptionInput {
  name: string;
  sortOrder?: number;
  values: CreateProductOptionValueInput[];
}

/** 更新商品輸入 */
export interface UpdateProductInput {
  /** 商品 ID（必填） */
  id: string;
  /** 商品名稱 */
  name?: string;
  /** SKU 編號 */
  sku?: string;
  /** 產品描述 */
  description?: string;
  /** 預設單價 */
  price?: number;
  /** 預設進貨成本 */
  cost?: number;
  /** 預設供應商 ID */
  defaultSupplierId?: string | null;
  /** 庫存數量 */
  stockQuantity?: number;
  /** 商品照片 S3 key 列表 */
  imageUrls?: string[];
  /** 啟用狀態 */
  isActive?: boolean;
}

/** 建立規格組合輸入 */
export interface CreateVariantInput {
  /** 規格顯示標籤（如「黑」、「L」、「黑 L」） */
  label: string;
  /** 單價偏移量（選填，null 或 0 表示無偏移） */
  priceOffset?: number | null;
  /** 成本偏移量（選填，null 或 0 表示無偏移） */
  costOffset?: number | null;
}

/** 更新規格組合輸入 */
export interface UpdateVariantInput {
  /** 單價偏移量（null 表示無偏移） */
  priceOffset?: number | null;
  /** 成本偏移量（null 表示無偏移） */
  costOffset?: number | null;
}
