import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
} from "@shared/models/order";
import { cancelOutOfStock } from "../functions/cancel-out-of-stock/resource";
import { cancelPurchase } from "../functions/cancel-purchase/resource";
import { cancelReceived } from "../functions/cancel-received/resource";
import { cancelShipment } from "../functions/cancel-shipment/resource";
import { confirmOutOfStock } from "../functions/confirm-out-of-stock/resource";
import { confirmPurchase } from "../functions/confirm-purchase/resource";
import { confirmReceived } from "../functions/confirm-received/resource";
import { confirmShipment } from "../functions/confirm-shipment/resource";
import { createProduct } from "../functions/create-product/resource";
import { getCustomerOrderSummaries } from "../functions/list-customer-order-summaries/resource";
import { getProductOrderSummaries } from "../functions/list-product-order-summaries/resource";
import { mergeOrders } from "../functions/merge-orders/resource";
import { splitOrder } from "../functions/split-order/resource";

const SORT_PARTITIONS = {
  customer: "Customer",
  customerOrderSummary: "CustomerOrderSummary",
  productOrderSummary: "ProductOrderSummary",
  supplier: "Supplier",
  product: "Product",
  order: "Order",
} as const;

const PREORDER_STATUSES = ["OPEN", "CLOSED"] as const;

type SortPartition = (typeof SORT_PARTITIONS)[keyof typeof SORT_PARTITIONS];
type FunctionResource = Parameters<typeof a.handler.function>[0];

function activeFlagField() {
  return a.boolean().required().default(true);
}

function createdAtForSortField() {
  return a.datetime();
}

function sortPartitionField(partition: SortPartition) {
  return a.string().required().default(partition);
}

function sortFields(partition: SortPartition) {
  return {
    gsiPartition: sortPartitionField(partition),
    createdAtForSort: createdAtForSortField(),
  };
}

function orderItemIdArgument() {
  return {
    orderItemId: a.string().required(),
  };
}

function authenticatedOrderItemMutation(resource: FunctionResource) {
  return a
    .mutation()
    .arguments(orderItemIdArgument())
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(resource));
}

function authenticatedJsonMutation<
  TArguments extends Parameters<ReturnType<typeof a.mutation>["arguments"]>[0],
>(argumentsShape: TArguments, resource: FunctionResource) {
  return a
    .mutation()
    .arguments(argumentsShape)
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(resource));
}

function authenticatedJsonQuery(resource: FunctionResource) {
  return a
    .query()
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(resource));
}

const schema = a.schema({
  // 訂單主狀態（沿用 shared/models/order.ts 的狀態值）
  OrderStatus: a.enum(ORDER_STATUSES),
  // 訂單付款狀態（沿用 shared/models/order.ts 的狀態值）
  PaymentStatus: a.enum(PAYMENT_STATUSES),
  // 訂單明細流程狀態（沿用 shared/models/order.ts 的狀態值）
  OrderItemStatus: a.enum(ORDER_ITEM_STATUSES),

  Customer: a
    .model({
      name: a.string().required(),
      phone: a.string(),
      email: a.string(),
      address: a.string(),
      note: a.string(),
      isActive: activeFlagField(),
      activeStatusKey: a.string().required().default("ACTIVE"),
      deletedAt: a.datetime(),
      orderCount: a.integer().required().default(0),
      orderCountForSort: a.integer().required().default(0),
      lastOrderedAt: a.datetime(),
      lastOrderedAtForSort: a.datetime().required(),
      ...sortFields(SORT_PARTITIONS.customer),
      orders: a.hasMany("Order", "customerId"),
    })
    .secondaryIndexes((index) => [
      index("name").queryField("customersByName").name("byName"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listCustomersByCreatedDate")
        .name("byCreatedAt"),
      index("activeStatusKey")
        .sortKeys(["lastOrderedAtForSort"])
        .queryField("listActiveCustomersByLastOrderedAt")
        .name("byActiveLastOrderedAt"),
      index("activeStatusKey")
        .sortKeys(["orderCountForSort"])
        .queryField("listActiveCustomersByOrderCount")
        .name("byActiveOrderCount"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  Supplier: a
    .model({
      name: a.string().required(),
      phone: a.string(),
      email: a.string(),
      address: a.string(),
      translationParser: a.string(),
      note: a.string(),
      isActive: activeFlagField(),
      deletedAt: a.datetime(),
      ...sortFields(SORT_PARTITIONS.supplier),
    })
    .secondaryIndexes((index) => [
      index("name").queryField("suppliersByName").name("byName"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listSuppliersByCreatedDate")
        .name("byCreatedAt"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  Product: a
    .model({
      name: a.string().required(),
      searchName: a.string(),
      sku: a.string().required(),
      sequenceNumber: a.integer().required(),
      description: a.string(),
      price: a.integer().required(),
      cost: a.integer().required(),
      defaultSupplierId: a.string(),
      stockQuantity: a.integer().required().default(0),
      imageUrls: a.string().array(),
      isActive: a.boolean().required().default(false),
      activeStatusKey: a.string().required().default("INACTIVE"),
      preorderStatus: a.enum(PREORDER_STATUSES),
      preorderOpenAt: a.datetime(),
      preorderCloseAt: a.datetime(),
      deletedAt: a.datetime(),
      ...sortFields(SORT_PARTITIONS.product),
      options: a.hasMany("ProductOption", "productId"),
      orderItems: a.hasMany("OrderItem", "productId"),
    })
    .secondaryIndexes((index) => [
      index("sku").queryField("productBySku").name("bySku"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listProductsByCreatedDate")
        .name("byCreatedAt"),
      index("activeStatusKey")
        .sortKeys(["createdAtForSort"])
        .queryField("listActiveProductsByCreatedDate")
        .name("byActiveStatusAndCreatedAt"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  ProductOption: a
    .model({
      productId: a.id().required(),
      product: a.belongsTo("Product", "productId"),
      name: a.string().required(),
      sortOrder: a.integer().required().default(0),
      values: a.hasMany("ProductOptionValue", "optionId"),
    })
    .secondaryIndexes((index) => [
      index("productId")
        .sortKeys(["sortOrder"])
        .queryField("listOptionsByProduct")
        .name("byProduct"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  ProductOptionValue: a
    .model({
      optionId: a.id().required(),
      option: a.belongsTo("ProductOption", "optionId"),
      name: a.string().required(),
      priceOffset: a.integer().required().default(0),
      costOffset: a.integer().required().default(0),
      sortOrder: a.integer().required().default(0),
    })
    .secondaryIndexes((index) => [
      index("optionId")
        .sortKeys(["sortOrder"])
        .queryField("listOptionValuesByOption")
        .name("byOption"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  Order: a
    .model({
      orderNumber: a.string().required(),

      // 客戶與收件資訊快照
      customerId: a.id(),
      customer: a.belongsTo("Customer", "customerId"),
      customerNameSnapshot: a.string().required(),
      customerPhoneSnapshot: a.string(),
      customerEmailSnapshot: a.string(),
      shippingAddressSnapshot: a.string(),

      // 訂單狀態摘要
      status: a.ref("OrderStatus").required(),
      paymentStatus: a.ref("PaymentStatus"),

      // 狀態時間戳記
      paidAt: a.datetime(),
      cancelledAt: a.datetime(),
      refundedAt: a.datetime(),
      completedAt: a.datetime(),

      // 金額快照
      subtotalAmount: a.integer().required(),
      shippingAmount: a.integer().required().default(0),
      discountAmount: a.integer().required().default(0),
      totalAmount: a.integer().required(),

      // 其他訂單資訊
      note: a.string(),
      statusHistory: a.json(),
      isActive: activeFlagField(),
      deletedAt: a.datetime(),
      ...sortFields(SORT_PARTITIONS.order),
      items: a.hasMany("OrderItem", "orderId"),
    })
    .secondaryIndexes((index) => [
      index("orderNumber").queryField("orderByNumber").name("byOrderNumber"),
      index("customerId")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrdersByCustomer")
        .name("byCustomer"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrdersByCreatedDate")
        .name("byCreatedAt"),
      index("paymentStatus")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrdersByPaymentStatus")
        .name("byPaymentStatus"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  OrderItem: a
    .model({
      orderId: a.id().required(),
      productId: a.id().required(),

      // 訂單明細流程狀態（採購 / 入庫 / 出貨）
      status: a.ref("OrderItemStatus").required(),

      // 商品快照
      productNameSnapshot: a.string().required(),
      productSkuSnapshot: a.string().required(),
      productImageUrlSnapshot: a.string(),

      // 下單當下選到的規格快照
      // 例如：
      // [
      //   { optionName: "顏色", valueName: "紅色", priceOffset: 0, costOffset: 0 },
      //   { optionName: "尺寸", valueName: "XL", priceOffset: 60, costOffset: 20 }
      // ]
      selectedOptionsSnapshot: a.json(),

      // 單價 / 成本快照
      unitPriceSnapshot: a.integer(),
      unitCostSnapshot: a.integer(),

      quantity: a.integer().required(),

      // 總額 / 總成本快照
      totalPriceSnapshot: a.integer(),
      totalCostSnapshot: a.integer(),

      // 採購資訊
      supplierName: a.string(),

      // 明細流程時間戳記
      purchasedAt: a.datetime(),
      receivedAt: a.datetime(),
      shippedAt: a.datetime(),
      outOfStockAt: a.datetime(),

      createdAtForSort: createdAtForSortField(),

      order: a.belongsTo("Order", "orderId"),
      product: a.belongsTo("Product", "productId"),
    })
    .secondaryIndexes((index) => [
      index("orderId")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrderItemsByOrderId")
        .name("byOrderId"),
      index("productId")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrderItemsByProductId")
        .name("byProductId"),
      index("status")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrderItemsByStatus")
        .name("byStatus"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  CustomerOrderSummary: a
    .model({
      customerId: a.id().required(),
      customerNameSnapshot: a.string().required(),
      readyToShipOrderCount: a.integer().required().default(0),
      receivedItemCount: a.integer().required().default(0),
      latestReceivedAt: a.datetime(),
      completedOrderCount: a.integer().required().default(0),
      totalOrderCount: a.integer().required().default(0),
      ...sortFields(SORT_PARTITIONS.customerOrderSummary),
    })
    .secondaryIndexes((index) => [
      index("customerId")
        .queryField("customerOrderSummaryByCustomer")
        .name("byCustomer"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listCustomerOrderSummariesByCreatedDate")
        .name("byCreatedAt"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  ProductOrderSummary: a
    .model({
      productId: a.id().required(),
      productNameSnapshot: a.string().required(),
      pendingQuantity: a.integer().required().default(0),
      orderedQuantity: a.integer().required().default(0),
      receivedQuantity: a.integer().required().default(0),
      shippedQuantity: a.integer().required().default(0),
      outOfStockQuantity: a.integer().required().default(0),
      totalQuantity: a.integer().required().default(0),
      latestActivityAt: a.datetime(),
      ...sortFields(SORT_PARTITIONS.productOrderSummary),
    })
    .secondaryIndexes((index) => [
      index("productId")
        .queryField("productOrderSummaryByProduct")
        .name("byProduct"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listProductOrderSummariesByCreatedDate")
        .name("byCreatedAt"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  SequenceCounter: a
    .model({
      name: a.string().required(),
      current: a.integer().required().default(0),
    })
    .secondaryIndexes((index) => [
      index("name").queryField("counterByName").name("byName"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  createProductWithAutoSku: authenticatedJsonMutation(
    {
      name: a.string().required(),
      description: a.string(),
      price: a.integer().required(),
      cost: a.integer().required(),
      defaultSupplierId: a.string(),
      stockQuantity: a.integer(),
      imageUrls: a.string().array(),
    },
    createProduct,
  ),

  confirmPurchase: authenticatedOrderItemMutation(confirmPurchase),
  cancelPurchase: authenticatedOrderItemMutation(cancelPurchase),
  confirmReceived: authenticatedOrderItemMutation(confirmReceived),
  cancelReceived: authenticatedOrderItemMutation(cancelReceived),
  confirmShipment: authenticatedOrderItemMutation(confirmShipment),
  cancelShipment: authenticatedOrderItemMutation(cancelShipment),
  confirmOutOfStock: authenticatedOrderItemMutation(confirmOutOfStock),
  cancelOutOfStock: authenticatedOrderItemMutation(cancelOutOfStock),
  getCustomerOrderSummaries: authenticatedJsonQuery(
    getCustomerOrderSummaries,
  ),
  getProductOrderSummaries: authenticatedJsonQuery(
    getProductOrderSummaries,
  ),

  mergeOrders: authenticatedJsonMutation(
    {
      orderIds: a.string().required().array().required(),
    },
    mergeOrders,
  ),

  splitOrder: authenticatedJsonMutation(
    {
      orderId: a.string().required(),
      allocations: a.json().required(),
    },
    splitOrder,
  ),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
