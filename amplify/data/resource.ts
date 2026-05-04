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
 * - ProductVariant：商品規格組合（獨立庫存、樂觀併發控制）
 * - Order：訂單（複合主鍵：CUSTOMER#{customerId} + ORDER#{createdAt}）
 * - LineItem：訂單明細項目（含規格組合關聯）
 * - PurchaseRecord：採購記錄（複合主鍵：LINEITEM#{lineItemId} + PURCHASE#{purchasedAt}）
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
      specDimensions: a.json(),
      imageUrls: a.string().array(),
      isActive: a.boolean().required().default(true),
      version: a.integer().required().default(1),
      variants: a.hasMany("ProductVariant", "productId"),
    })
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // ProductVariant（商品規格組合）
  // ---------------------------------------------------------------------------
  ProductVariant: a
    .model({
      productId: a.id().required(),
      product: a.belongsTo("Product", "productId"),
      combination: a.json().required(),
      label: a.string().required(),
      sku: a.string().required(),
      stockQuantity: a.integer().required().default(0),
      unitPriceOverride: a.float(),
      defaultCostOverride: a.float(),
      version: a.integer().required().default(1),
    })
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // Order（訂單）
  // 複合主鍵：PK = CUSTOMER#{customerId}, SK = ORDER#{createdAt}
  // ---------------------------------------------------------------------------
  Order: a
    .model({
      customerId: a.string().required(),
      sortKey: a.string().required(),
      orderNumber: a.string().required(),
      customerName: a.string().required(),
      totalAmount: a.float().required(),
      status: a.string().required().default("pending"),
      statusHistory: a.json(),
      lineItems: a.hasMany("LineItem", "orderId"),
    })
    .identifier(["customerId", "sortKey"])
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // LineItem（訂單明細項目）
  // ---------------------------------------------------------------------------
  LineItem: a
    .model({
      orderId: a.string().required(),
      orderSortKey: a.string().required(),
      order: a.belongsTo("Order", ["orderId", "orderSortKey"]),
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
      orderedAt: a.datetime(),
      receivedAt: a.datetime(),
      shippedAt: a.datetime(),
      purchaseRecords: a.hasMany("PurchaseRecord", "lineItemId"),
    })
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // PurchaseRecord（採購記錄）
  // 複合主鍵：PK = lineItemId, SK = purchasedAt
  // ---------------------------------------------------------------------------
  PurchaseRecord: a
    .model({
      lineItemId: a.string().required(),
      purchasedAt: a.datetime().required(),
      lineItem: a.belongsTo("LineItem", "lineItemId"),
      supplierId: a.string().required(),
      supplierName: a.string().required(),
      quantity: a.integer().required(),
      unitCost: a.float().required(),
      status: a.string().required().default("pending"),
      statusHistory: a.json(),
      receivedAt: a.datetime(),
    })
    .identifier(["lineItemId", "purchasedAt"])
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // Custom Mutations（事務性操作，由 Lambda 函式處理）
  // ---------------------------------------------------------------------------

  /** 出貨操作：扣減庫存 + 更新明細狀態 + 條件性更新訂單狀態 */
  shipLineItem: a
    .mutation()
    .arguments({
      orderId: a.string().required(),
      orderSortKey: a.string().required(),
      lineItemId: a.string().required(),
      quantity: a.integer().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(shipLineItem)),

  /** 入庫確認：增加庫存 + 更新採購記錄狀態 + 更新明細狀態 */
  confirmReceived: a
    .mutation()
    .arguments({
      purchaseRecordId: a.string().required(),
      purchaseRecordSortKey: a.string().required(),
      lineItemId: a.string().required(),
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
      orderSortKey: a.string().required(),
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
