import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { shipLineItem } from "../functions/ship-line-item/resource";
import { confirmReceived } from "../functions/confirm-received/resource";
import { mergeOrders } from "../functions/merge-orders/resource";
import { splitOrder } from "../functions/split-order/resource";

/**
 * 電子商務訂單管理系統 — Amplify Gen2 Data Schema
 *
 * 模型：
 * - Customer：客戶基本資料（含軟刪除 isActive 欄位）
 * - Supplier：供應商基本資料（含軟刪除 isActive 欄位）
 * - Product：商品基本資料（含規格維度、照片、樂觀併發控制）
 * - ProductVariant：商品規格組合（獨立庫存）
 * - Order：訂單（單一 id 主鍵，透過 GSI 依建立日期排序）
 * - LineItem：訂單明細項目（含規格組合關聯、採購數據內嵌）
 *
 * Custom Mutations（Lambda 函式）：
 * - shipLineItem：出貨操作（庫存扣減 + 狀態更新，TransactWriteItems）
 * - confirmReceived：入庫確認（庫存增加 + 狀態更新，TransactWriteItems）
 * - mergeOrders：訂單合併（建立新訂單 + 搬移明細 + 取消來源，TransactWriteItems）
 * - splitOrder：訂單分拆（建立多筆新訂單 + 分配明細 + 取消原訂單，TransactWriteItems）
 *
 * 授權規則：僅已驗證使用者可存取
 */
const schema = a.schema({
  // ---------------------------------------------------------------------------
  // Customer（客戶）
  // ---------------------------------------------------------------------------
  Customer: a
    .model({
      name: a.string().required(),
      contactPerson: a.string().required(),
      phone: a.string().required(),
      email: a.string(),
      address: a.string(),
      isActive: a.boolean().required().default(true),
    })
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // Supplier（供應商）
  // ---------------------------------------------------------------------------
  Supplier: a
    .model({
      name: a.string().required(),
      contactPerson: a.string().required(),
      phone: a.string().required(),
      email: a.string(),
      address: a.string(),
      isActive: a.boolean().required().default(true),
    })
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // Product（商品）
  // ---------------------------------------------------------------------------
  Product: a
    .model({
      name: a.string().required(),
      sku: a.string().required(),
      unitPrice: a.float().required(),
      defaultCost: a.float().required(),
      defaultSupplierId: a.string(),
      stockQuantity: a.integer().required().default(0),
      imageUrls: a.string().array(),
      isActive: a.boolean().required().default(true),
      version: a.integer().required().default(1),
      /** GSI 分區鍵：固定值 "Product"，用於按建立日期排序查詢全部商品 */
      gsiPartition: a.string().required().default("Product"),
      /** 建立時間（ISO 8601），用於 GSI 排序，避免與 Amplify 內建 createdAt 混淆 */
      createdAtForSort: a.datetime(),
      variants: a.hasMany("ProductVariant", "productId"),
    })
    .secondaryIndexes((index) => [
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listByCreatedDate")
        .name("byCreatedAt"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // ProductVariant（商品規格組合）
  // ---------------------------------------------------------------------------
  ProductVariant: a
    .model({
      productId: a.id().required(),
      product: a.belongsTo("Product", "productId"),
      label: a.string().required(),
      sku: a.string().required(),
      stockQuantity: a.integer().required().default(0),
      price: a.float(),
      cost: a.float(),
    })
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // Order（訂單）
  // 單一主鍵：id；列表透過 GSI 依建立日期排序
  // ---------------------------------------------------------------------------
  Order: a
    .model({
      customerId: a.string().required(),
      orderNumber: a.string().required(),
      customerName: a.string().required(),
      totalAmount: a.float().required(),
      status: a.string().required().default("pending"),
      statusHistory: a.json(),
      /** GSI 分區鍵：固定值 "Order"，用於按建立日期排序查詢全部訂單 */
      gsiPartition: a.string().required().default("Order"),
      /** 建立時間（ISO 8601），用於 GSI 排序，避免與 Amplify 內建 createdAt 混淆 */
      createdAtForSort: a.datetime(),
      lineItems: a.hasMany("LineItem", "orderId"),
    })
    .secondaryIndexes((index) => [
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listByCreatedDate")
        .name("byOrderCreatedAt"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // LineItem（訂單明細項目）
  // ---------------------------------------------------------------------------
  LineItem: a
    .model({
      orderId: a.string().required(),
      order: a.belongsTo("Order", "orderId"),
      productId: a.string().required(),
      productName: a.string().required(),
      variantId: a.string(),
      variantLabel: a.string(),
      quantity: a.integer().required(),
      unitPrice: a.float().required(),
      subtotal: a.float().required(),
      status: a.string().required().default("待處理"),
      purchasedQuantity: a.integer().required().default(0),
      shippedQuantity: a.integer().required().default(0),
      purchasedAt: a.datetime(),
      receivedAt: a.datetime(),
      shippedAt: a.datetime(),
      supplierId: a.string(),
      supplierName: a.string(),
      unitCost: a.float(),
    })
    .secondaryIndexes((index) => [index("orderId").name("byOrderId")])
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // Custom Mutations（事務性操作，由 Lambda 函式處理）
  // ---------------------------------------------------------------------------

  /** 出貨操作：扣減庫存 + 更新明細狀態 + 條件性更新訂單狀態 */
  shipLineItem: a
    .mutation()
    .arguments({
      orderId: a.string().required(),
      lineItemId: a.string().required(),
      quantity: a.integer().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(shipLineItem)),

  /** 入庫確認：增加庫存 + 更新明細狀態 */
  confirmReceived: a
    .mutation()
    .arguments({
      lineItemId: a.string().required(),
      orderId: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(confirmReceived)),

  /** 訂單合併：建立新訂單 + 搬移明細 + 取消來源訂單 */
  mergeOrders: a
    .mutation()
    .arguments({
      orderIds: a.json().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(mergeOrders)),

  /** 訂單分拆：建立多筆新訂單 + 分配明細 + 取消原訂單 */
  splitOrder: a
    .mutation()
    .arguments({
      orderId: a.string().required(),
      allocations: a.json().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(splitOrder)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
