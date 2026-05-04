/**
 * 商品（Product）、規格維度（SpecDimension）、規格組合（ProductVariant）資料模型
 *
 * 需求：3.1, 3.2, 3.3, 3.9, 3.10, 3.12, 3.13, 3.14, 3.15
 */

/** 規格維度（如「顏色」、「尺寸」） */
export interface SpecDimension {
  /** 維度名稱（如「顏色」、「尺寸」） */
  name: string;
  /** 選項值列表（如 ["紅", "黑", "白"]） */
  values: string[];
}

/** 商品規格組合（如「黑 L」、「白 XL」） */
export interface ProductVariant {
  /** 唯一識別碼 */
  id: string;
  /** 規格組合（如 { "顏色": "黑", "尺寸": "L" }） */
  combination: Record<string, string>;
  /** 組合顯示標籤（如「黑 L」，由 combination 值以空格串接） */
  label: string;
  /** 規格組合 SKU（唯一，可自訂或系統自動產生） */
  sku: string;
  /** 規格組合庫存數量（>= 0） */
  stockQuantity: number;
  /** 單價覆寫（null 表示沿用商品預設單價） */
  unitPriceOverride: number | null;
  /** 進貨成本覆寫（null 表示沿用商品預設成本） */
  defaultCostOverride: number | null;
  /** 樂觀併發控制版本號（每次庫存更新時遞增） */
  version: number;
}

/** 商品基本資料 */
export interface Product {
  /** 唯一識別碼 */
  id: string;
  /** 商品名稱（必填） */
  name: string;
  /** SKU 編號（必填，唯一） */
  sku: string;
  /** 預設單價（必填，>= 0） */
  unitPrice: number;
  /** 預設進貨成本（必填，>= 0） */
  defaultCost: number;
  /** 預設供應商 ID（選填） */
  defaultSupplierId: string | null;
  /** 庫存數量（>= 0，無規格組合時使用此欄位追蹤庫存） */
  stockQuantity: number;
  /** 規格維度定義（如顏色、尺寸） */
  specDimensions: SpecDimension[];
  /** 規格組合列表（由 specDimensions 笛卡爾積產生） */
  variants: ProductVariant[];
  /** 商品照片 S3 key 列表（存放於 product-images/{productId}/ 路徑下） */
  imageUrls: string[];
  /** 啟用狀態（預設 true，false 表示已停用） */
  isActive: boolean;
  /** 樂觀併發控制版本號（無規格組合時，庫存更新時遞增） */
  version: number;
  /** ISO 8601 建立時間 */
  createdAt: string;
  /** ISO 8601 更新時間 */
  updatedAt: string;
}

/** 建立商品輸入 */
export interface CreateProductInput {
  /** 商品名稱（必填） */
  name: string;
  /** SKU 編號（必填，唯一） */
  sku: string;
  /** 預設單價（必填，>= 0） */
  unitPrice: number;
  /** 預設進貨成本（必填，>= 0） */
  defaultCost: number;
  /** 預設供應商 ID（選填） */
  defaultSupplierId?: string | null;
  /** 初始庫存數量（選填，預設 0） */
  stockQuantity?: number;
  /** 規格維度定義（選填） */
  specDimensions?: SpecDimension[];
  /** 商品照片 S3 key 列表（選填） */
  imageUrls?: string[];
}

/** 更新商品輸入 */
export interface UpdateProductInput {
  /** 商品 ID（必填） */
  id: string;
  /** 商品名稱 */
  name?: string;
  /** SKU 編號 */
  sku?: string;
  /** 預設單價 */
  unitPrice?: number;
  /** 預設進貨成本 */
  defaultCost?: number;
  /** 預設供應商 ID */
  defaultSupplierId?: string | null;
  /** 庫存數量 */
  stockQuantity?: number;
  /** 規格維度定義 */
  specDimensions?: SpecDimension[];
  /** 商品照片 S3 key 列表 */
  imageUrls?: string[];
}

/** 建立規格組合輸入 */
export interface CreateVariantInput {
  /** 規格組合（如 { "顏色": "黑", "尺寸": "L" }） */
  combination: Record<string, string>;
  /** 組合顯示標籤（如「黑 L」） */
  label: string;
  /** 規格組合 SKU（選填，未提供時系統自動產生） */
  sku?: string;
  /** 初始庫存數量（選填，預設 0） */
  stockQuantity?: number;
  /** 單價覆寫（選填，null 表示沿用商品預設單價） */
  unitPriceOverride?: number | null;
  /** 進貨成本覆寫（選填，null 表示沿用商品預設成本） */
  defaultCostOverride?: number | null;
}

/** 更新規格組合輸入 */
export interface UpdateVariantInput {
  /** 規格組合 SKU */
  sku?: string;
  /** 庫存數量 */
  stockQuantity?: number;
  /** 單價覆寫（null 表示沿用商品預設單價） */
  unitPriceOverride?: number | null;
  /** 進貨成本覆寫（null 表示沿用商品預設成本） */
  defaultCostOverride?: number | null;
}
