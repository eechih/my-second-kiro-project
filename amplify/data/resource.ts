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
import { createProduct } from "../functions/create-product/resource";
import { mergeOrders } from "../functions/merge-orders/resource";
import { splitOrder } from "../functions/split-order/resource";

const SORT_PARTITIONS = {
  customer: "Customer",
  supplier: "Supplier",
  product: "Product",
  order: "Order",
} as const;

type SortPartition =
  (typeof SORT_PARTITIONS)[keyof typeof SORT_PARTITIONS];
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

function lineItemIdArgument() {
  return {
    lineItemId: a.string().required(),
  };
}

function authenticatedLineItemMutation(resource: FunctionResource) {
  return a
    .mutation()
    .arguments(lineItemIdArgument())
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

const schema = a.schema({
  // 訂單流程狀態（沿用 shared/models/order.ts 的狀態值）
  OrderStatus: a.enum(ORDER_STATUSES),
  // 訂單明細流程狀態（沿用 shared/models/order.ts 的狀態值）
  OrderItemStatus: a.enum(LINE_ITEM_STATUSES),

  Customer: a
    .model({
      name: a.string().required(),
      contactPerson: a.string(),
      phone: a.string(),
      email: a.string(),
      address: a.string(),
      note: a.string(),
      isActive: activeFlagField(),
      deletedAt: a.datetime(),
      ...sortFields(SORT_PARTITIONS.customer),
      orders: a.hasMany("Order", "customerId"),
    })
    .secondaryIndexes((index) => [
      index("name").queryField("customersByName").name("byName"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listCustomersByCreatedDate")
        .name("byCreatedAt"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  Supplier: a
    .model({
      name: a.string().required(),
      contactPerson: a.string(),
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
      description: a.string(),
      price: a.integer().required(),
      cost: a.integer().required(),
      defaultSupplierId: a.string(),
      stockQuantity: a.integer().required().default(0),
      imageUrls: a.string().array(),
      isActive: activeFlagField(),
      // 預購收單狀態：草稿 / 開放收單 / 關閉收單
      preorderStatus: a.enum(["DRAFT", "OPEN", "CLOSED"]),
      preorderOpenAt: a.datetime(),
      preorderCloseAt: a.datetime(),
      deletedAt: a.datetime(),
      ...sortFields(SORT_PARTITIONS.product),
      variants: a.hasMany("ProductVariant", "productId"),
      orderItems: a.hasMany("OrderItem", "productId"),
    })
    .secondaryIndexes((index) => [
      index("name").queryField("productsByName").name("byName"),
      index("sku").queryField("productBySku").name("bySku"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listProductsByCreatedDate")
        .name("byCreatedAt"),
      index("preorderStatus")
        .sortKeys(["preorderCloseAt"])
        .queryField("listProductsByPreorderStatusAndCloseDate")
        .name("byPreorderStatusAndCloseDate"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  ProductVariant: a
    .model({
      productId: a.id().required(),
      product: a.belongsTo("Product", "productId"),
      label: a.string().required(),
      priceOffset: a.integer().required().default(0),
      costOffset: a.integer().required().default(0),
      sortOrder: a.integer().required().default(0),
      isActive: activeFlagField(),
      deletedAt: a.datetime(),
      createdAtForSort: createdAtForSortField(),
    })
    .secondaryIndexes((index) => [
      index("productId")
        .sortKeys(["sortOrder"])
        .queryField("listVariantsByProduct")
        .name("byProduct"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  Order: a
    .model({
      orderNumber: a.string().required(),
      customerId: a.id(),
      customer: a.belongsTo("Customer", "customerId"),
      customerNameSnapshot: a.string().required(),
      customerPhoneSnapshot: a.string(),
      customerEmailSnapshot: a.string(),
      shippingAddressSnapshot: a.string(),
      // 付款狀態：未付款 / 已付款 / 已退款
      paymentStatus: a.enum(["UNPAID", "PAID", "REFUNDED"]),
      // 履約狀態：待處理 / 部分到貨 / 可出貨 / 部分出貨 / 全部出貨 / 完成
      fulfillmentStatus: a.enum([
        "PENDING",
        "PARTIALLY_RECEIVED",
        "READY_TO_SHIP",
        "PARTIALLY_SHIPPED",
        "SHIPPED",
        "COMPLETED",
      ]),
      cancelledAt: a.datetime(),
      subtotalAmount: a.integer().required(),
      shippingFee: a.integer().required().default(0),
      discountAmount: a.integer().required().default(0),
      totalAmount: a.integer().required(),
      note: a.string(),
      // 訂單主狀態（前端流程與 Lambda 判斷主要依據）
      status: a.ref("OrderStatus").required(),
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
      index("fulfillmentStatus")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrdersByFulfillmentStatus")
        .name("byFulfillmentStatus"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  OrderItem: a
    .model({
      orderId: a.id().required(),
      order: a.belongsTo("Order", "orderId"),
      productId: a.id().required(),
      product: a.belongsTo("Product", "productId"),
      productVariantId: a.id(),
      quantity: a.integer().required(),
      unitPrice: a.integer().required(),
      subtotalAmount: a.integer().required(),
      // 訂單明細狀態（採購 / 入庫 / 出貨流程主要依據）
      status: a.ref("OrderItemStatus").required(),
      productNameSnapshot: a.string().required(),
      productSkuSnapshot: a.string().required(),
      variantLabelSnapshot: a.string(),
      supplierName: a.string(),
      unitCost: a.integer(),
      purchasedAt: a.datetime(),
      receivedAt: a.datetime(),
      shippedAt: a.datetime(),
      outOfStockAt: a.datetime(),
      createdAtForSort: createdAtForSortField(),
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

  confirmPurchase: authenticatedLineItemMutation(confirmPurchase),
  cancelPurchase: authenticatedLineItemMutation(cancelPurchase),
  confirmReceived: authenticatedLineItemMutation(confirmReceived),
  cancelReceived: authenticatedLineItemMutation(cancelReceived),
  confirmShipment: authenticatedLineItemMutation(confirmShipment),
  cancelShipment: authenticatedLineItemMutation(cancelShipment),
  confirmOutOfStock: authenticatedLineItemMutation(confirmOutOfStock),
  cancelOutOfStock: authenticatedLineItemMutation(cancelOutOfStock),

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
