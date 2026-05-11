import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { LINE_ITEM_STATUSES, ORDER_STATUSES } from "@shared/models/order";
import { cancelOutOfStock } from "../functions/cancel-out-of-stock/resource";
import { cancelPurchase } from "../functions/cancel-purchase/resource";
import { cancelReceived } from "../functions/cancel-received/resource";
import { cancelShipment } from "../functions/cancel-shipment/resource";
import { confirmOutOfStock } from "../functions/confirm-out-of-stock/resource";
import { confirmPurchase } from "../functions/confirm-purchase/resource";
import { confirmReceived } from "../functions/confirm-received/resource";
import { confirmShipment } from "../functions/confirm-shipment/resource";
import { mergeOrders } from "../functions/merge-orders/resource";
import { splitOrder } from "../functions/split-order/resource";

/**
 * 電子商務訂單管理系統 — Amplify Gen2 Data Schema
 *
 * 模型：
 * - Customer：客戶基本資料（含軟刪除 isActive 欄位）
 * - Supplier：供應商基本資料（含軟刪除 isActive 欄位）
 * - Product：商品基本資料（含照片、商品層級庫存、預設售價與成本）
 * - ProductVariant：商品規格選項（只保存顯示標籤與價格/成本偏移）
 * - Order：訂單（單一 id 主鍵，透過 GSI 依建立日期排序）
 * - LineItem：訂單明細項目（含規格組合關聯、採購數據內嵌）
 *
 * Custom Mutations（Lambda 函式）：
 * - confirmPurchase：確認採購（採購資料 + 狀態更新，TransactWriteItems）
 * - cancelPurchase：取消採購（清除採購資料 + 狀態更新，TransactWriteItems）
 * - shipLineItem：出貨操作（庫存扣減 + 狀態更新，TransactWriteItems，由 confirm-shipment Lambda 處理）
 * - cancelShipment：取消出貨（庫存加回 + 狀態更新，TransactWriteItems）
 * - confirmReceived：入庫確認（庫存增加 + 狀態更新，TransactWriteItems）
 * - cancelReceived：取消入庫（庫存扣回 + 狀態更新，TransactWriteItems）
 * - confirmOutOfStock：確認缺貨（缺貨狀態 + 時間戳，TransactWriteItems）
 * - cancelOutOfStock：取消缺貨（狀態回推 + 清除時間戳，TransactWriteItems）
 * - mergeOrders：訂單合併（建立新訂單 + 搬移明細 + 取消來源，TransactWriteItems）
 * - splitOrder：訂單分拆（建立多筆新訂單 + 分配明細 + 取消原訂單，TransactWriteItems）
 *
 * 授權規則：僅已驗證使用者可存取
 */
const PRODUCT_SORT_PARTITION = "Product";
const ORDER_SORT_PARTITION = "Order";

const schema = a.schema({
  // ---------------------------------------------------------------------------
  // Enums
  // ---------------------------------------------------------------------------
  OrderStatus: a.enum(ORDER_STATUSES),
  LineItemStatus: a.enum(LINE_ITEM_STATUSES),

  // ---------------------------------------------------------------------------
  // Customer（客戶）
  // ---------------------------------------------------------------------------
  Customer: a
    .model({
      name: a.string().required(),
      contactPerson: a.string(),
      phone: a.string(),
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
      contactPerson: a.string(),
      phone: a.string(),
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
      price: a.float().required(),
      cost: a.float().required(),
      defaultSupplierId: a.string(),
      stockQuantity: a.integer().required().default(0),
      imageUrls: a.string().array(),
      isActive: a.boolean().required().default(true),
      /** GSI 分區鍵：固定值 "Product"，用於按建立日期排序查詢全部商品 */
      gsiPartition: a.string().required().default(PRODUCT_SORT_PARTITION),
      /** 建立時間（ISO 8601），用於 GSI 排序，避免與 Amplify 內建 createdAt 混淆 */
      createdAtForSort: a.datetime(),
      variants: a.hasMany("ProductVariant", "productId"),
    })
    .secondaryIndexes((index) => [
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listProductsByCreatedDate")
        .name("byCreatedAt"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // ProductVariant（商品規格選項）
  // ---------------------------------------------------------------------------
  ProductVariant: a
    .model({
      productId: a.id().required(),
      product: a.belongsTo("Product", "productId"),
      label: a.string().required(),
      priceOffset: a.float(),
      costOffset: a.float(),
      lineItems: a.hasMany("LineItem", "variantId"),
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
      status: a.ref("OrderStatus").required(),
      statusHistory: a.json(),
      /** GSI 分區鍵：固定值 "Order"，用於按建立日期排序查詢全部訂單 */
      gsiPartition: a.string().required().default(ORDER_SORT_PARTITION),
      /** 建立時間（ISO 8601），用於 GSI 排序，避免與 Amplify 內建 createdAt 混淆 */
      createdAtForSort: a.datetime(),
      lineItems: a.hasMany("LineItem", "orderId"),
    })
    .secondaryIndexes((index) => [
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrdersByCreatedDate")
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
      variant: a.belongsTo("ProductVariant", "variantId"),
      variantLabel: a.string(),
      quantity: a.integer().required(),
      unitPrice: a.float().required(),
      subtotal: a.float().required(),
      status: a.ref("LineItemStatus").required(),
      purchasedQuantity: a.integer().required().default(0),
      shippedQuantity: a.integer().required().default(0),
      purchasedAt: a.datetime(),
      receivedAt: a.datetime(),
      shippedAt: a.datetime(),
      outOfStockAt: a.datetime(),
      supplierId: a.string(),
      supplierName: a.string(),
      unitCost: a.float(),
    })
    .secondaryIndexes((index) => [index("orderId").name("byOrderId")])
    .authorization((allow) => [allow.authenticated()]),

  // ---------------------------------------------------------------------------
  // Custom Mutations（事務性操作，由 Lambda 函式處理）
  // ---------------------------------------------------------------------------

  /** 確認採購：更新採購資料 + 明細狀態 */
  confirmPurchase: a
    .mutation()
    .arguments({
      orderId: a.string().required(),
      lineItemId: a.string().required(),
      supplierId: a.string(),
      supplierName: a.string(),
      unitCost: a.float(),
      quantity: a.integer(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(confirmPurchase)),

  /** 取消採購：清除採購資料 + 明細狀態回待處理 */
  cancelPurchase: a
    .mutation()
    .arguments({
      orderId: a.string().required(),
      lineItemId: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(cancelPurchase)),

  /** 確認出貨：扣減庫存 + 更新明細狀態 + 條件性更新訂單狀態 */
  confirmShipment: a
    .mutation()
    .arguments({
      orderId: a.string().required(),
      lineItemId: a.string().required(),
      quantity: a.integer().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(confirmShipment)),

  /** 取消出貨：加回庫存 + 更新明細與訂單狀態 */
  cancelShipment: a
    .mutation()
    .arguments({
      orderId: a.string().required(),
      lineItemId: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(cancelShipment)),

  /** 入庫確認：增加庫存 + 更新明細狀態 */
  confirmReceived: a
    .mutation()
    .arguments({
      lineItemId: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(confirmReceived)),

  /** 取消入庫：扣回庫存 + 更新明細狀態 */
  cancelReceived: a
    .mutation()
    .arguments({
      lineItemId: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(cancelReceived)),

  /** 確認缺貨：更新明細狀態 + 記錄缺貨時間 */
  confirmOutOfStock: a
    .mutation()
    .arguments({
      lineItemId: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(confirmOutOfStock)),

  /** 取消缺貨：依既有時間戳回推明細狀態 */
  cancelOutOfStock: a
    .mutation()
    .arguments({
      lineItemId: a.string().required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(cancelOutOfStock)),

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
