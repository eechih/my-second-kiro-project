import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import {
  ORDER_FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
} from "@shared/models/order";
import { SHIPMENT_STATUSES } from "@shared/models/shipment";
import { cancelOutOfStock } from "../functions/cancel-out-of-stock/resource";
import { cancelPurchase } from "../functions/cancel-purchase/resource";
import { cancelReceived } from "../functions/cancel-received/resource";
import { cancelShipment } from "../functions/cancel-shipment/resource";
import { confirmOutOfStock } from "../functions/confirm-out-of-stock/resource";
import { confirmPurchase } from "../functions/confirm-purchase/resource";
import { confirmReceived } from "../functions/confirm-received/resource";
import { confirmShipment } from "../functions/confirm-shipment/resource";
import { createProduct } from "../functions/create-product/resource";
import { createShipmentFn } from "../functions/create-shipment/resource";
import { confirmShipmentDispatch } from "../functions/confirm-shipment-dispatch/resource";
import { confirmShipmentDelivery } from "../functions/confirm-shipment-delivery/resource";
import { cancelShipmentOrder } from "../functions/cancel-shipment-order/resource";
import { addOrderToShipment } from "../functions/add-order-to-shipment/resource";
import { removeOrderFromShipment } from "../functions/remove-order-from-shipment/resource";
import { getCustomerOrderSummaries } from "../functions/list-customer-order-summaries/resource";
import { getProductOrderSummaries } from "../functions/list-product-order-summaries/resource";

const SORT_PARTITIONS = {
  customer: "Customer",
  customerOrderSummary: "CustomerOrderSummary",
  productOrderSummary: "ProductOrderSummary",
  supplierOrderSummary: "SupplierOrderSummary",
  supplier: "Supplier",
  product: "Product",
  order: "Order",
  shipment: "Shipment",
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
  // 訂單履約狀態（沿用 shared/models/order.ts 的狀態值）
  OrderStatus: a.enum(ORDER_FULFILLMENT_STATUSES),
  // 訂單付款狀態（沿用 shared/models/order.ts 的狀態值）
  PaymentStatus: a.enum(PAYMENT_STATUSES),
  // 出貨單狀態（沿用 shared/models/shipment.ts 的狀態值）
  ShipmentStatus: a.enum(SHIPMENT_STATUSES),

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

      // 商品快照（原 OrderItem 整合）
      productId: a.id().required(),
      productNameSnapshot: a.string().required(),
      productSkuSnapshot: a.string().required(),
      productImageUrlSnapshot: a.string(),
      selectedOptionsSnapshot: a.json(),

      // 數量與金額快照（原 OrderItem 整合）
      quantity: a.integer().required(),
      unitPriceSnapshot: a.integer(),
      unitCostSnapshot: a.integer(),
      totalPriceSnapshot: a.integer(),
      totalCostSnapshot: a.integer(),

      // 訂單狀態摘要
      status: a.ref("OrderStatus").required(),
      paymentStatus: a.ref("PaymentStatus"),

      // 狀態時間戳記
      paidAt: a.datetime(),
      cancelledAt: a.datetime(),
      refundedAt: a.datetime(),
      completedAt: a.datetime(),

      // 採購與物流時間戳記（原 OrderItem 整合）
      supplierName: a.string(),
      supplierStatusSort: a.string(),
      customerStatusSort: a.string(),
      purchasedAt: a.datetime(),
      receivedAt: a.datetime(),
      shippedAt: a.datetime(),
      outOfStockAt: a.datetime(),

      // 出貨單關聯
      shipmentId: a.string(),

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
      index("status")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrdersByStatus")
        .name("byStatus"),
      index("productId")
        .sortKeys(["createdAtForSort"])
        .queryField("listOrdersByProductId")
        .name("byProductId"),
      index("shipmentId")
        .queryField("listOrdersByShipmentId")
        .name("byShipmentId"),
      index("supplierName")
        .sortKeys(["supplierStatusSort"])
        .queryField("listOrdersBySupplierStatus")
        .name("bySupplierStatus"),
      index("customerId")
        .sortKeys(["customerStatusSort"])
        .queryField("listOrdersByCustomerStatus")
        .name("byCustomerStatus"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  Shipment: a
    .model({
      shipmentNumber: a.string().required(),
      recipientName: a.string().required(),
      recipientPhone: a.string(),
      recipientAddress: a.string(),
      status: a.ref("ShipmentStatus").required(),
      shippingMethod: a.string(),
      trackingNumber: a.string(),
      actualShippingCost: a.integer().required().default(0),
      shippedAt: a.datetime(),
      deliveredAt: a.datetime(),
      cancelledAt: a.datetime(),
      note: a.string(),
      ...sortFields(SORT_PARTITIONS.shipment),
    })
    .secondaryIndexes((index) => [
      index("shipmentNumber")
        .queryField("shipmentByNumber")
        .name("byShipmentNumber"),
      index("gsiPartition")
        .sortKeys(["createdAtForSort"])
        .queryField("listShipmentsByCreatedDate")
        .name("byCreatedAt"),
      index("status")
        .sortKeys(["createdAtForSort"])
        .queryField("listShipmentsByStatus")
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
      productSkuSnapshot: a.string(),
      productImageUrlSnapshot: a.string(),
      priceSnapshot: a.integer().required().default(0),
      costSnapshot: a.integer().required().default(0),
      supplierNameSnapshot: a.string(),
      pendingQuantity: a.integer().required().default(0),
      orderedQuantity: a.integer().required().default(0),
      receivedQuantity: a.integer().required().default(0),
      shippedQuantity: a.integer().required().default(0),
      outOfStockQuantity: a.integer().required().default(0),
      completedQuantity: a.integer().default(0),
      cancelledQuantity: a.integer().default(0),
      totalQuantity: a.integer().required().default(0),
      latestActivityAt: a.datetime(),
      ...sortFields(SORT_PARTITIONS.productOrderSummary),
    })
    .secondaryIndexes((index) => [
      index("productId")
        .queryField("productOrderSummaryByProduct")
        .name("byProduct"),
      index("gsiPartition")
        .sortKeys(["pendingQuantity"])
        .queryField("listProductOrderSummariesByPendingQuantity")
        .name("byPendingQuantity"),
    ])
    .authorization((allow) => [allow.authenticated()]),

  SupplierOrderSummary: a
    .model({
      supplierNameSnapshot: a.string().required(),
      orderedQuantity: a.integer().required().default(0),
      receivedQuantity: a.integer().required().default(0),
      totalQuantity: a.integer().required().default(0),
      latestActivityAt: a.datetime(),
      ...sortFields(SORT_PARTITIONS.supplierOrderSummary),
    })
    .secondaryIndexes((index) => [
      index("supplierNameSnapshot")
        .queryField("supplierOrderSummaryBySupplier")
        .name("bySupplier"),
      index("gsiPartition")
        .sortKeys(["orderedQuantity"])
        .queryField("listSupplierOrderSummariesByOrderedQuantity")
        .name("byOrderedQuantity"),
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

  confirmPurchase: authenticatedJsonMutation(
    {
      orderIds: a.string().array().required(),
      supplierName: a.string().required(),
    },
    confirmPurchase,
  ),
  cancelPurchase: authenticatedJsonMutation(
    { orderIds: a.string().array().required() },
    cancelPurchase,
  ),
  confirmReceived: authenticatedJsonMutation(
    { orderIds: a.string().array().required() },
    confirmReceived,
  ),
  cancelReceived: authenticatedJsonMutation(
    { orderIds: a.string().array().required() },
    cancelReceived,
  ),
  confirmShipment: authenticatedJsonMutation(
    { orderId: a.string().required() },
    confirmShipment,
  ),
  cancelShipment: authenticatedJsonMutation(
    { orderId: a.string().required() },
    cancelShipment,
  ),
  confirmOutOfStock: authenticatedJsonMutation(
    { orderIds: a.string().array().required() },
    confirmOutOfStock,
  ),
  cancelOutOfStock: authenticatedJsonMutation(
    { orderIds: a.string().array().required() },
    cancelOutOfStock,
  ),

  // Shipment mutations
  createShipmentWithOrders: authenticatedJsonMutation(
    {
      recipientName: a.string().required(),
      recipientPhone: a.string(),
      recipientAddress: a.string(),
      shippingMethod: a.string(),
      trackingNumber: a.string(),
      actualShippingCost: a.integer(),
      note: a.string(),
      orderIds: a.string().required().array().required(),
    },
    createShipmentFn,
  ),
  confirmShipmentDispatch: authenticatedJsonMutation(
    { shipmentId: a.string().required() },
    confirmShipmentDispatch,
  ),
  confirmShipmentDelivery: authenticatedJsonMutation(
    { shipmentId: a.string().required() },
    confirmShipmentDelivery,
  ),
  cancelShipmentOrder: authenticatedJsonMutation(
    { shipmentId: a.string().required() },
    cancelShipmentOrder,
  ),
  addOrderToShipment: authenticatedJsonMutation(
    { shipmentId: a.string().required(), orderId: a.string().required() },
    addOrderToShipment,
  ),
  removeOrderFromShipment: authenticatedJsonMutation(
    { shipmentId: a.string().required(), orderId: a.string().required() },
    removeOrderFromShipment,
  ),
  getCustomerOrderSummaries: authenticatedJsonQuery(getCustomerOrderSummaries),
  getProductOrderSummaries: authenticatedJsonQuery(getProductOrderSummaries),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
