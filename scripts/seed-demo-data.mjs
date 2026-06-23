import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import Mock from "mockjs";
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { buildCustomerOrderSummariesFromOrders } from "./customer-order-summary-lib.mjs";
import { buildProductOrderSummariesFromOrders } from "./product-order-summary-lib.mjs";
import { buildSupplierOrderSummariesFromOrders } from "./supplier-order-summary-lib.mjs";
import { assertLocalDemoScriptEnvironment } from "./demo-script-guard.mjs";

const { Random } = Mock;

const DEFAULT_CUSTOMER_COUNT = 32;
const DEFAULT_PRODUCT_COUNT = 64;
const DEFAULT_ORDER_COUNT = 96;

const ACTIVE_STATUS = {
  active: "ACTIVE",
  inactive: "INACTIVE",
};

function deriveProductActiveState(preorderStatus) {
  if (preorderStatus === "OPEN") {
    return {
      isActive: true,
      activeStatusKey: ACTIVE_STATUS.active,
    };
  }

  return {
    isActive: false,
    activeStatusKey: ACTIVE_STATUS.inactive,
  };
}

const ORDER_SCENARIOS = [
  {
    status: "PENDING",
    paymentStatus: "UNPAID",
    timeline: "pending",
  },
  {
    status: "ORDERED",
    paymentStatus: "PAID",
    timeline: "ordered",
  },
  {
    status: "RECEIVED",
    paymentStatus: "PAID",
    timeline: "received",
  },
  {
    status: "SHIPPED",
    paymentStatus: "PAID",
    timeline: "shipped",
  },
  {
    status: "COMPLETED",
    paymentStatus: "PAID",
    timeline: "completed",
  },
  {
    status: "CANCELLED",
    paymentStatus: "UNPAID",
    timeline: "cancelled",
  },
  {
    status: "COMPLETED",
    paymentStatus: "REFUNDED",
    timeline: "refunded",
  },
];

const PRODUCT_PREFIXES = [
  "經典",
  "輕盈",
  "旅行",
  "日常",
  "職人",
  "極簡",
  "海鹽",
  "晨光",
  "暖霧",
  "城市",
];

const PRODUCT_NOUNS = [
  "帆布袋",
  "保溫瓶",
  "桌墊",
  "收納盒",
  "文件夾",
  "筆記本",
  "馬克杯",
  "抱枕",
  "毛巾",
  "便條夾",
];

const CITY_NAMES = ["台北市", "新北市", "桃園市", "台中市", "台南市", "高雄市"];

const CUSTOMER_SURNAMES = [
  "陳",
  "林",
  "黃",
  "張",
  "李",
  "王",
  "吳",
  "劉",
  "蔡",
  "楊",
  "許",
  "鄭",
];

const CUSTOMER_GIVEN_NAMES = [
  "怡君",
  "冠廷",
  "雅婷",
  "家豪",
  "欣怡",
  "柏翰",
  "詩涵",
  "宇翔",
  "佳穎",
  "俊傑",
  "佩蓉",
  "承恩",
  "宥蓁",
  "品妤",
  "彥廷",
  "思妤",
];

const CUSTOMER_STORE_PREFIXES = [
  "小日子",
  "禾木",
  "青山",
  "慢慢來",
  "日日",
  "有光",
  "好好",
  "木子",
];

const CUSTOMER_STORE_SUFFIXES = [
  "選物",
  "工作室",
  "生活館",
  "小舖",
  "商行",
  "雜貨舖",
];

const TRANSLATION_SUPPLIERS = [
  "wish",
  "cat",
  "money",
  "boom",
  "boom_p4",
  "yoshida",
  "mitago",
  "apple",
];

const SUPPLIER_NAMES = [
  "Wish",
  "葉貓子批發",
  "Money",
  "生意興隆",
  "生意興隆P4",
  "吉田",
  "米塔購",
  "天魁批發",
];

const MAX_SUPPLIER_COUNT = TRANSLATION_SUPPLIERS.length;
const BATCH_WRITE_LIMIT = 25;
const MAX_BATCH_RETRIES = 5;

const OPTION_TEMPLATES = [
  {
    name: "顏色",
    values: [
      { name: "黑色", priceOffset: 0, costOffset: 0 },
      { name: "米白", priceOffset: 10, costOffset: 4 },
      { name: "灰藍", priceOffset: 20, costOffset: 8 },
    ],
  },
  {
    name: "尺寸",
    values: [
      { name: "S", priceOffset: 0, costOffset: 0 },
      { name: "M", priceOffset: 15, costOffset: 5 },
      { name: "L", priceOffset: 30, costOffset: 10 },
    ],
  },
  {
    name: "材質",
    values: [
      { name: "標準", priceOffset: 0, costOffset: 0 },
      { name: "厚磅", priceOffset: 25, costOffset: 12 },
    ],
  },
];

const SHIPPING_METHODS = [
  "黑貓宅急便",
  "7-11 店到店",
  "全家店到店",
  "郵局掛號",
  "新竹物流",
];

function parseArgs(argv) {
  const args = {
    customers: DEFAULT_CUSTOMER_COUNT,
    products: DEFAULT_PRODUCT_COUNT,
    orders: DEFAULT_ORDER_COUNT,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const nextValue = argv[index + 1];

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--customers" && nextValue) {
      args.customers = Number.parseInt(nextValue, 10) || args.customers;
      index += 1;
      continue;
    }

    if (token === "--products" && nextValue) {
      args.products = Number.parseInt(nextValue, 10) || args.products;
      index += 1;
      continue;
    }

    if (token === "--orders" && nextValue) {
      args.orders = Number.parseInt(nextValue, 10) || args.orders;
      index += 1;
    }
  }

  return args;
}

function validateArgs(args) {
  const entries = [
    ["customers", args.customers],
    ["products", args.products],
    ["orders", args.orders],
  ];

  for (const [key, value] of entries) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} 必須是大於 0 的整數`);
    }
  }
}

function formatSku(sequenceNumber) {
  return `SKU-${String(sequenceNumber).padStart(6, "0")}`;
}

function formatOrderNumber(date, orderIndex) {
  const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `ORD-${datePart}-${String(orderIndex).padStart(4, "0")}`;
}

function formatShipmentNumber(index) {
  return `SHP-${String(index + 1).padStart(6, "0")}`;
}

function offsetIso(dateString, offsetHours) {
  return new Date(
    new Date(dateString).getTime() + offsetHours * 3600000,
  ).toISOString();
}

function weightedCustomerIndex(orderIndex, customerCount) {
  const favoredPool = Math.max(5, Math.floor(customerCount * 0.35));
  if (orderIndex % 5 === 0) {
    return orderIndex % customerCount;
  }
  return orderIndex % favoredPool;
}

function buildFakeCustomerName(index) {
  if (index % 5 === 0) {
    const storeIndex = Math.floor(index / 5);
    const prefix =
      CUSTOMER_STORE_PREFIXES[storeIndex % CUSTOMER_STORE_PREFIXES.length];
    const suffix =
      CUSTOMER_STORE_SUFFIXES[
        Math.floor(storeIndex / CUSTOMER_STORE_PREFIXES.length) %
          CUSTOMER_STORE_SUFFIXES.length
      ];
    return `${prefix}${suffix}`;
  }

  const personIndex = index - Math.ceil(index / 5);
  const surname = CUSTOMER_SURNAMES[personIndex % CUSTOMER_SURNAMES.length];
  const givenName =
    CUSTOMER_GIVEN_NAMES[
      Math.floor(personIndex / CUSTOMER_SURNAMES.length) %
        CUSTOMER_GIVEN_NAMES.length
    ];
  return `${surname}${givenName}`;
}

function buildFakeCustomer(index, orderCount, lastOrderedAt) {
  const city = Random.pick(CITY_NAMES);
  const createdAt = new Date(
    Date.now() - (index + 14) * 86400000,
  ).toISOString();
  const district = Random.pick([
    "中正區",
    "大安區",
    "板橋區",
    "西屯區",
    "東區",
    "左營區",
  ]);
  const roadName = Random.pick([
    "中山路",
    "民生路",
    "忠孝路",
    "文化路",
    "光復路",
    "和平路",
  ]);
  const roadNumber = Random.integer(1, 300);

  return {
    id: randomUUID(),
    name: buildFakeCustomerName(index),
    phone: `09${String(Random.integer(10000000, 99999999))}`,
    email: `demo-customer-${index + 1}@example.com`,
    address: `${city}${district}${roadName}${roadNumber}號`,
    note: "Seed demo customer",
    isActive: true,
    activeStatusKey: ACTIVE_STATUS.active,
    orderCount,
    orderCountForSort: orderCount,
    lastOrderedAt,
    lastOrderedAtForSort: lastOrderedAt ?? createdAt,
    deletedAt: null,
    gsiPartition: "Customer",
    createdAtForSort: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

function validateSeedConsistency({
  customers,
  orders,
  shipments,
  customerOrderSummaries,
  products,
  productOrderSummaries,
  supplierOrderSummaries,
}) {
  const customerIds = new Set(customers.map((customer) => customer.id));
  const customerNames = new Set();
  const productIds = new Set(products.map((product) => product.id));

  for (const customer of customers) {
    if (!customer.id) {
      throw new Error("客戶假資料缺少 id");
    }

    if (!customer.name) {
      throw new Error(`客戶 ${customer.id} 缺少名稱`);
    }

    if (customerNames.has(customer.name)) {
      throw new Error(`客戶名稱重複：${customer.name}`);
    }

    customerNames.add(customer.name);
  }

  for (const order of orders) {
    if (!customerIds.has(order.customerId)) {
      throw new Error(
        `訂單 ${order.id} 指向不存在的 customerId：${order.customerId}`,
      );
    }
  }

  // 1. Order product snapshot completeness
  for (const order of orders) {
    const requiredFields = [
      "productId",
      "productNameSnapshot",
      "productSkuSnapshot",
      "quantity",
      "unitPriceSnapshot",
      "totalPriceSnapshot",
      "subtotalAmount",
      "totalAmount",
      "status",
    ];

    for (const field of requiredFields) {
      if (order[field] == null) {
        throw new Error(`訂單 ${order.id} 缺少必要欄位：${field}`);
      }
    }
  }

  // 2. Order amount calculations
  for (const order of orders) {
    if (order.totalPriceSnapshot !== order.quantity * order.unitPriceSnapshot) {
      throw new Error(
        `訂單 ${order.id} 的 totalPriceSnapshot 計算不正確：expected ${order.quantity * order.unitPriceSnapshot}, got ${order.totalPriceSnapshot}`,
      );
    }

    if (order.unitCostSnapshot != null) {
      const expectedTotalCost = order.quantity * order.unitCostSnapshot;
      if (order.totalCostSnapshot !== expectedTotalCost) {
        throw new Error(
          `訂單 ${order.id} 的 totalCostSnapshot 計算不正確：expected ${expectedTotalCost}, got ${order.totalCostSnapshot}`,
        );
      }
    }

    if (order.subtotalAmount !== order.totalPriceSnapshot) {
      throw new Error(
        `訂單 ${order.id} 的 subtotalAmount 應等於 totalPriceSnapshot：expected ${order.totalPriceSnapshot}, got ${order.subtotalAmount}`,
      );
    }

    const expectedTotalAmount =
      order.subtotalAmount +
      (order.shippingAmount ?? 0) -
      (order.discountAmount ?? 0);
    if (order.totalAmount !== expectedTotalAmount) {
      throw new Error(
        `訂單 ${order.id} 的 totalAmount 計算不正確：expected ${expectedTotalAmount}, got ${order.totalAmount}`,
      );
    }
  }

  // 3. Order status-timeline consistency
  for (const order of orders) {
    if (order.status === "ORDERED" && order.purchasedAt == null) {
      throw new Error(`訂單 ${order.id} 狀態為 ORDERED 但缺少 purchasedAt`);
    }

    if (order.status === "RECEIVED") {
      if (order.purchasedAt == null) {
        throw new Error(`訂單 ${order.id} 狀態為 RECEIVED 但缺少 purchasedAt`);
      }
      if (order.receivedAt == null) {
        throw new Error(`訂單 ${order.id} 狀態為 RECEIVED 但缺少 receivedAt`);
      }
    }

    if (order.status === "SHIPPED") {
      if (order.purchasedAt == null) {
        throw new Error(`訂單 ${order.id} 狀態為 SHIPPED 但缺少 purchasedAt`);
      }
      if (order.receivedAt == null) {
        throw new Error(`訂單 ${order.id} 狀態為 SHIPPED 但缺少 receivedAt`);
      }
      if (order.shippedAt == null) {
        throw new Error(`訂單 ${order.id} 狀態為 SHIPPED 但缺少 shippedAt`);
      }
    }

    if (order.status === "COMPLETED") {
      if (order.shippedAt == null) {
        throw new Error(`訂單 ${order.id} 狀態為 COMPLETED 但缺少 shippedAt`);
      }
      if (order.completedAt == null) {
        throw new Error(`訂單 ${order.id} 狀態為 COMPLETED 但缺少 completedAt`);
      }
    }

    if (order.status === "CANCELLED" && order.cancelledAt == null) {
      throw new Error(`訂單 ${order.id} 狀態為 CANCELLED 但缺少 cancelledAt`);
    }
  }

  // 4. Shipment-Order relationship and status consistency
  const shipmentIds = new Set(shipments.map((s) => s.id));

  for (const order of orders) {
    if (order.shipmentId && !shipmentIds.has(order.shipmentId)) {
      throw new Error(
        `訂單 ${order.id} 指向不存在的 shipmentId：${order.shipmentId}`,
      );
    }
  }

  // Group orders by shipmentId for shipment-status consistency checks
  const ordersByShipment = new Map();
  for (const order of orders) {
    if (order.shipmentId) {
      if (!ordersByShipment.has(order.shipmentId)) {
        ordersByShipment.set(order.shipmentId, []);
      }
      ordersByShipment.get(order.shipmentId).push(order);
    }
  }

  for (const shipment of shipments) {
    const associatedOrders = ordersByShipment.get(shipment.id) ?? [];

    if (shipment.status === "SHIPPED") {
      for (const order of associatedOrders) {
        if (order.status !== "SHIPPED") {
          throw new Error(
            `出貨單 ${shipment.id} 狀態為 SHIPPED，但關聯訂單 ${order.id} 狀態為 ${order.status}（應為 SHIPPED）`,
          );
        }
        if (order.shippedAt == null) {
          throw new Error(
            `出貨單 ${shipment.id} 狀態為 SHIPPED，但關聯訂單 ${order.id} 缺少 shippedAt`,
          );
        }
      }
    }

    if (shipment.status === "DELIVERED") {
      for (const order of associatedOrders) {
        if (order.status !== "COMPLETED") {
          throw new Error(
            `出貨單 ${shipment.id} 狀態為 DELIVERED，但關聯訂單 ${order.id} 狀態為 ${order.status}（應為 COMPLETED）`,
          );
        }
        if (order.completedAt == null) {
          throw new Error(
            `出貨單 ${shipment.id} 狀態為 DELIVERED，但關聯訂單 ${order.id} 缺少 completedAt`,
          );
        }
      }
    }

    if (shipment.status === "PENDING") {
      for (const order of associatedOrders) {
        if (order.status !== "RECEIVED") {
          throw new Error(
            `出貨單 ${shipment.id} 狀態為 PENDING，但關聯訂單 ${order.id} 狀態為 ${order.status}（應為 RECEIVED）`,
          );
        }
      }
    }
  }

  // 5. Verify productId references
  for (const order of orders) {
    if (!productIds.has(order.productId)) {
      throw new Error(
        `訂單 ${order.id} 的 productId 指向不存在的商品：${order.productId}`,
      );
    }
  }

  for (const summary of customerOrderSummaries) {
    if (!customerIds.has(summary.customerId)) {
      throw new Error(
        `摘要 ${summary.id} 指向不存在的 customerId：${summary.customerId}`,
      );
    }

    if (
      summary.customerNameSnapshot !==
      customers.find((customer) => customer.id === summary.customerId)?.name
    ) {
      throw new Error(
        `摘要 ${summary.id} 的 customerNameSnapshot 與客戶主檔不一致`,
      );
    }
  }

  for (const summary of productOrderSummaries) {
    if (!productIds.has(summary.productId)) {
      throw new Error(
        `商品摘要 ${summary.id} 指向不存在的 productId：${summary.productId}`,
      );
    }

    if (
      summary.productNameSnapshot !==
      products.find((product) => product.id === summary.productId)?.name
    ) {
      throw new Error(
        `商品摘要 ${summary.id} 的 productNameSnapshot 與商品主檔不一致`,
      );
    }

    const matchedProduct = products.find(
      (product) => product.id === summary.productId,
    );
    if (matchedProduct && summary.productSkuSnapshot !== matchedProduct.sku) {
      throw new Error(
        `商品摘要 ${summary.id} 的 productSkuSnapshot 與商品主檔不一致（摘要=${summary.productSkuSnapshot}，商品=${matchedProduct.sku}）`,
      );
    }
  }

  if (productOrderSummaries.length !== products.length) {
    throw new Error("商品摘要數量應與商品數量一致");
  }

  const expectedSupplierSummaries = new Map();

  for (const order of orders) {
    const supplierName = String(order.supplierName ?? "").trim();
    const status = String(order.status ?? "");

    if (!supplierName) {
      continue;
    }

    const current = expectedSupplierSummaries.get(supplierName) ?? {
      orderedQuantity: 0,
      receivedQuantity: 0,
      totalQuantity: 0,
    };

    if (status === "ORDERED") {
      current.orderedQuantity += Number(order.quantity ?? 0);
    }

    if (status === "RECEIVED") {
      current.receivedQuantity += Number(order.quantity ?? 0);
    }

    if (status === "ORDERED" || status === "RECEIVED") {
      current.totalQuantity += Number(order.quantity ?? 0);
    }

    expectedSupplierSummaries.set(supplierName, current);
  }

  for (const summary of supplierOrderSummaries) {
    if (!summary.supplierNameSnapshot) {
      throw new Error("供應商摘要缺少 supplierNameSnapshot");
    }

    const expected = expectedSupplierSummaries.get(
      summary.supplierNameSnapshot,
    ) ?? {
      orderedQuantity: 0,
      receivedQuantity: 0,
      totalQuantity: 0,
    };

    if (summary.orderedQuantity !== expected.orderedQuantity) {
      throw new Error(
        `供應商摘要 ${summary.supplierNameSnapshot} 的 orderedQuantity 不一致`,
      );
    }

    if (summary.receivedQuantity !== expected.receivedQuantity) {
      throw new Error(
        `供應商摘要 ${summary.supplierNameSnapshot} 的 receivedQuantity 不一致`,
      );
    }

    if (summary.totalQuantity !== expected.totalQuantity) {
      throw new Error(
        `供應商摘要 ${summary.supplierNameSnapshot} 的 totalQuantity 不一致`,
      );
    }
  }
}

function buildOrderTimeline(createdAt, scenario) {
  switch (scenario.timeline) {
    case "pending":
      return {
        purchasedAt: null,
        receivedAt: null,
        shippedAt: null,
        outOfStockAt: null,
        paidAt: null,
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
    case "ordered":
      return {
        purchasedAt: offsetIso(createdAt, 6),
        receivedAt: null,
        shippedAt: null,
        outOfStockAt: null,
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
    case "received":
      return {
        purchasedAt: offsetIso(createdAt, 6),
        receivedAt: offsetIso(createdAt, 30),
        shippedAt: null,
        outOfStockAt: null,
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
    case "shipped":
      return {
        purchasedAt: offsetIso(createdAt, 6),
        receivedAt: offsetIso(createdAt, 30),
        shippedAt: offsetIso(createdAt, 54),
        outOfStockAt: null,
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
    case "completed":
      return {
        purchasedAt: offsetIso(createdAt, 6),
        receivedAt: offsetIso(createdAt, 30),
        shippedAt: offsetIso(createdAt, 54),
        outOfStockAt: null,
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: null,
        completedAt: offsetIso(createdAt, 72),
      };
    case "cancelled":
      return {
        purchasedAt: null,
        receivedAt: null,
        shippedAt: null,
        outOfStockAt: null,
        paidAt: null,
        cancelledAt: offsetIso(createdAt, 4),
        refundedAt: null,
        completedAt: null,
      };
    case "refunded":
      return {
        purchasedAt: offsetIso(createdAt, 6),
        receivedAt: offsetIso(createdAt, 30),
        shippedAt: offsetIso(createdAt, 54),
        outOfStockAt: null,
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: offsetIso(createdAt, 96),
        completedAt: offsetIso(createdAt, 72),
      };
    default:
      return {
        purchasedAt: null,
        receivedAt: null,
        shippedAt: null,
        outOfStockAt: null,
        paidAt: null,
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
  }
}

function buildOrderStatusHistory(createdAt, scenario, timeline) {
  const history = [
    {
      fromStatus: "",
      toStatus: "PENDING",
      changedAt: createdAt,
    },
  ];

  if (scenario.status === "PENDING") {
    return history;
  }

  if (timeline.paidAt) {
    history.push({
      fromStatus: "PENDING",
      toStatus: "ORDERED",
      changedAt: timeline.paidAt,
    });
  }

  if (
    (scenario.status === "RECEIVED" ||
      scenario.status === "SHIPPED" ||
      scenario.status === "COMPLETED") &&
    timeline.receivedAt
  ) {
    history.push({
      fromStatus: "ORDERED",
      toStatus: "RECEIVED",
      changedAt: timeline.receivedAt,
    });
  }

  if (
    (scenario.status === "SHIPPED" || scenario.status === "COMPLETED") &&
    timeline.shippedAt
  ) {
    history.push({
      fromStatus: "RECEIVED",
      toStatus: "SHIPPED",
      changedAt: timeline.shippedAt,
    });
  }

  if (scenario.status === "CANCELLED" && timeline.cancelledAt) {
    history.push({
      fromStatus: "PENDING",
      toStatus: "CANCELLED",
      changedAt: timeline.cancelledAt,
    });
  }

  if (scenario.status === "COMPLETED" && timeline.completedAt) {
    history.push({
      fromStatus: "SHIPPED",
      toStatus: "COMPLETED",
      changedAt: timeline.completedAt,
    });
  }

  return history;
}

function buildFakeSupplier(index) {
  const createdAt = new Date(
    Date.now() - (index + 21) * 86400000,
  ).toISOString();
  const city = CITY_NAMES[index % CITY_NAMES.length];
  const translationParser =
    TRANSLATION_SUPPLIERS[index % TRANSLATION_SUPPLIERS.length];

  return {
    id: randomUUID(),
    name: SUPPLIER_NAMES[index % SUPPLIER_NAMES.length],
    phone: `02${String(10000000 + index).slice(0, 8)}`,
    email: `demo-supplier-${index + 1}@example.com`,
    address: `${city}供應路 ${index + 1} 號`,
    translationParser,
    note: "Seed demo supplier",
    isActive: true,
    deletedAt: null,
    gsiPartition: "Supplier",
    createdAtForSort: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildFakeProduct(index, sequenceNumber, suppliers, totalProducts) {
  const prefix = PRODUCT_PREFIXES[index % PRODUCT_PREFIXES.length];
  const noun = PRODUCT_NOUNS[index % PRODUCT_NOUNS.length];
  const createdAt = new Date(
    Date.now() - (totalProducts - index + 10) * 43200000,
  ).toISOString();
  const price = 180 + (index % 6) * 70;
  const cost = Math.max(60, Math.round(price * 0.58));
  const supplier = suppliers[index % suppliers.length] ?? null;
  const optionTemplates = resolveProductOptionTemplates(index);
  const productOptions = optionTemplates.map((template, optionIndex) =>
    buildProductOption(template, optionIndex),
  );
  const preorderStatus = index % 10 < 7 ? "OPEN" : "CLOSED";
  const preorderCloseAt =
    preorderStatus === "OPEN"
      ? offsetIso(createdAt, 24 * 7)
      : preorderStatus === "CLOSED"
        ? offsetIso(createdAt, 24 * 3)
        : null;
  const activeState = deriveProductActiveState(preorderStatus);

  return {
    id: randomUUID(),
    name: `${prefix}${noun}`,
    sku: formatSku(sequenceNumber),
    sequenceNumber,
    description: `這是用於本機展示的假資料商品：${prefix}${noun}`,
    price,
    cost,
    defaultSupplierId: supplier?.id ?? null,
    defaultSupplierName: supplier?.name ?? null,
    stockQuantity: 50 + (index % 8) * 12,
    imageUrls: [],
    isActive: activeState.isActive,
    activeStatusKey: activeState.activeStatusKey,
    preorderStatus,
    preorderCloseAt,
    gsiPartition: "Product",
    createdAtForSort: createdAt,
    createdAt,
    updatedAt: createdAt,
    seedOptions: productOptions,
  };
}

function buildOrder(orderIndex, customer, products) {
  const statusConfig = ORDER_SCENARIOS[orderIndex % ORDER_SCENARIOS.length];
  const createdAt = new Date(
    Date.now() - (orderIndex + 1) * 21600000,
  ).toISOString();

  // Each order is now one product (flat)
  const product = products[(orderIndex * 2) % products.length];
  const quantity = 1 + (orderIndex % 4);
  const supplierName = product.defaultSupplierName ?? null;

  // Build product snapshot fields
  const selectedOptionsSnapshot = (product.seedOptions ?? []).map((option) => {
    const selectedValue = option.values[0];
    return {
      optionName: option.name,
      valueName: selectedValue.name,
      priceOffset: selectedValue.priceOffset,
      costOffset: selectedValue.costOffset,
    };
  });
  const priceOffset = selectedOptionsSnapshot.reduce(
    (sum, option) => sum + option.priceOffset,
    0,
  );
  const costOffset = selectedOptionsSnapshot.reduce(
    (sum, option) => sum + option.costOffset,
    0,
  );
  const unitPrice = product.price + priceOffset;
  const unitCost = product.cost + costOffset;
  const totalPrice = unitPrice * quantity;
  const totalCost = unitCost * quantity;

  const timeline = buildOrderTimeline(createdAt, statusConfig);
  const statusHistory = buildOrderStatusHistory(
    createdAt,
    statusConfig,
    timeline,
  );

  const updatedAtCandidates = [
    createdAt,
    timeline.paidAt,
    timeline.cancelledAt,
    timeline.refundedAt,
    timeline.completedAt,
    timeline.shippedAt,
    timeline.receivedAt,
    timeline.purchasedAt,
  ].filter((value) => typeof value === "string");
  const updatedAt = updatedAtCandidates.reduce((latest, current) =>
    current > latest ? current : latest,
  );

  return {
    id: randomUUID(),
    orderNumber: formatOrderNumber(new Date(createdAt), orderIndex + 1),
    customerId: customer.id,
    customerNameSnapshot: customer.name,
    customerPhoneSnapshot: customer.phone,
    customerEmailSnapshot: customer.email,
    shippingAddressSnapshot: customer.address,
    // Product snapshot (flat)
    productId: product.id,
    productNameSnapshot: product.name,
    productSkuSnapshot: product.sku,
    productImageUrlSnapshot: null,
    selectedOptionsSnapshot,
    // Quantity & price
    quantity,
    unitPriceSnapshot: unitPrice,
    unitCostSnapshot: unitCost,
    totalPriceSnapshot: totalPrice,
    totalCostSnapshot: totalCost,
    subtotalAmount: totalPrice,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: totalPrice,
    // Status
    status: statusConfig.status,
    paymentStatus: statusConfig.paymentStatus,
    // Procurement & logistics timestamps
    supplierName,
    purchasedAt: timeline.purchasedAt,
    receivedAt: timeline.receivedAt,
    shippedAt: timeline.shippedAt,
    outOfStockAt: timeline.outOfStockAt,
    // Payment & terminal timestamps
    paidAt: timeline.paidAt,
    cancelledAt: timeline.cancelledAt,
    refundedAt: timeline.refundedAt,
    completedAt: timeline.completedAt,
    // Misc
    note: "Seed demo order",
    statusHistory,
    shipmentId: undefined,
    supplierStatusSort: supplierName
      ? `${statusConfig.status}#${createdAt}`
      : undefined,
    customerStatusSort: `${statusConfig.status}#${createdAt}`,
    isActive: true,
    deletedAt: null,
    gsiPartition: "Order",
    createdAtForSort: createdAt,
    createdAt,
    updatedAt,
  };
}

function buildFakeShipments(orders) {
  // Shipment plan: ~3 PENDING, ~4 SHIPPED, ~4 DELIVERED, ~2 CANCELLED
  const shipmentPlan = [
    { status: "PENDING", count: 3 },
    { status: "SHIPPED", count: 4 },
    { status: "DELIVERED", count: 4 },
    { status: "CANCELLED", count: 2 },
  ];

  // Collect orders by status for association
  const receivedOrders = orders.filter((o) => o.status === "RECEIVED");
  const shippedOrders = orders.filter((o) => o.status === "SHIPPED");
  const completedOrders = orders.filter(
    (o) => o.status === "COMPLETED" && o.paymentStatus === "PAID",
  );

  const shipments = [];
  let shipmentIndex = 0;
  let receivedIdx = 0;
  let shippedIdx = 0;
  let completedIdx = 0;

  for (const plan of shipmentPlan) {
    for (let i = 0; i < plan.count; i += 1) {
      const createdAt = new Date(
        Date.now() - (shipmentIndex + 1) * 43200000,
      ).toISOString();

      const shipment = buildSingleShipment(
        shipmentIndex,
        plan.status,
        createdAt,
      );
      shipments.push(shipment);

      // Associate 1-3 orders with this shipment
      const associationCount = 1 + (shipmentIndex % 3);

      if (plan.status === "PENDING") {
        // PENDING shipments -> associated orders must be RECEIVED status
        for (
          let j = 0;
          j < associationCount && receivedIdx < receivedOrders.length;
          j += 1
        ) {
          receivedOrders[receivedIdx].shipmentId = shipment.id;
          receivedIdx += 1;
        }
      } else if (plan.status === "SHIPPED") {
        // SHIPPED shipments -> associated orders must be SHIPPED with shippedAt
        for (
          let j = 0;
          j < associationCount && shippedIdx < shippedOrders.length;
          j += 1
        ) {
          shippedOrders[shippedIdx].shipmentId = shipment.id;
          shippedIdx += 1;
        }
      } else if (plan.status === "DELIVERED") {
        // DELIVERED shipments -> associated orders must be COMPLETED with completedAt
        for (
          let j = 0;
          j < associationCount && completedIdx < completedOrders.length;
          j += 1
        ) {
          completedOrders[completedIdx].shipmentId = shipment.id;
          completedIdx += 1;
        }
      } else if (plan.status === "CANCELLED") {
        // CANCELLED shipments -> associated orders should be RECEIVED (reverted)
        for (
          let j = 0;
          j < associationCount && receivedIdx < receivedOrders.length;
          j += 1
        ) {
          receivedOrders[receivedIdx].shipmentId = shipment.id;
          receivedIdx += 1;
        }
      }

      shipmentIndex += 1;
    }
  }

  return shipments;
}

function buildSingleShipment(index, status, createdAt) {
  const shippedAt =
    status === "SHIPPED" || status === "DELIVERED"
      ? offsetIso(createdAt, 24)
      : null;
  const deliveredAt = status === "DELIVERED" ? offsetIso(createdAt, 72) : null;
  const cancelledAt = status === "CANCELLED" ? offsetIso(createdAt, 12) : null;

  const updatedAtCandidates = [
    createdAt,
    shippedAt,
    deliveredAt,
    cancelledAt,
  ].filter((v) => typeof v === "string");
  const updatedAt = updatedAtCandidates.reduce((latest, current) =>
    current > latest ? current : latest,
  );

  return {
    id: randomUUID(),
    shipmentNumber: formatShipmentNumber(index),
    recipientName: `收件人${index + 1}`,
    recipientPhone: `09${String(Random.integer(10000000, 99999999))}`,
    recipientAddress: `${Random.pick(CITY_NAMES)}測試路${index + 1}號`,
    status,
    shippingMethod: Random.pick(SHIPPING_METHODS),
    trackingNumber:
      status !== "PENDING" ? `TRK${String(100000 + index)}` : null,
    actualShippingCost: status !== "PENDING" ? 60 + (index % 5) * 20 : 0,
    shippedAt,
    deliveredAt,
    cancelledAt,
    note: status === "CANCELLED" ? "客戶取消" : null,
    gsiPartition: "Shipment",
    createdAtForSort: createdAt,
    createdAt,
    updatedAt,
  };
}

async function loadTableNames() {
  const raw = await readFile(
    new URL("../amplify_outputs.json", import.meta.url),
    "utf8",
  );
  const outputs = JSON.parse(raw);
  const tables = outputs?.custom?.tables ?? {};

  const tableNames = {
    customer: tables.Customer?.tableName,
    supplier: tables.Supplier?.tableName,
    product: tables.Product?.tableName,
    productOption: tables.ProductOption?.tableName,
    productOptionValue: tables.ProductOptionValue?.tableName,
    order: tables.Order?.tableName,
    shipment: tables.Shipment?.tableName,
    customerOrderSummary: tables.CustomerOrderSummary?.tableName,
    productOrderSummary: tables.ProductOrderSummary?.tableName,
    supplierOrderSummary: tables.SupplierOrderSummary?.tableName,
    sequenceCounter: tables.SequenceCounter?.tableName,
  };

  for (const [key, value] of Object.entries(tableNames)) {
    if (!value) {
      throw new Error(`找不到資料表名稱：${key}`);
    }
  }

  return tableNames;
}

async function scanMaxProductSequence(ddb, tableName) {
  let maxSequence = 0;
  let lastEvaluatedKey;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: "sequenceNumber, sku",
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    for (const item of result.Items ?? []) {
      const record = unmarshall(item);
      const sequenceNumber = Number(record.sequenceNumber ?? 0);
      maxSequence = Math.max(maxSequence, sequenceNumber);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return maxSequence;
}

async function getNextProductSequence(ddb, tableNames) {
  const counterKey = { id: "ProductSku" };
  const counterResult = await ddb.send(
    new GetItemCommand({
      TableName: tableNames.sequenceCounter,
      Key: marshall(counterKey),
    }),
  );

  if (counterResult.Item) {
    const record = unmarshall(counterResult.Item);
    return Number(record.current ?? 0) + 1;
  }

  const maxSequence = await scanMaxProductSequence(ddb, tableNames.product);
  return maxSequence + 1;
}

async function upsertSequenceCounter(ddb, tableName, current) {
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ id: "ProductSku" }),
      UpdateExpression:
        "SET #name = :name, #current = :current, #updatedAt = :updatedAt, #createdAt = if_not_exists(#createdAt, :createdAt)",
      ExpressionAttributeNames: {
        "#name": "name",
        "#current": "current",
        "#updatedAt": "updatedAt",
        "#createdAt": "createdAt",
      },
      ExpressionAttributeValues: marshall({
        ":name": "ProductSku",
        ":current": current,
        ":updatedAt": now,
        ":createdAt": now,
      }),
    }),
  );
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function batchWriteWithRetry(ddb, tableName, items) {
  let pendingRequests = items.map((item) => ({
    PutRequest: {
      Item: marshall(item, { removeUndefinedValues: true }),
    },
  }));

  for (let attempt = 0; pendingRequests.length > 0; attempt += 1) {
    if (attempt > MAX_BATCH_RETRIES) {
      throw new Error(
        `${tableName} 批次寫入失敗，仍有 ${pendingRequests.length} 筆未完成`,
      );
    }

    const result = await ddb.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: pendingRequests,
        },
      }),
    );

    pendingRequests = result.UnprocessedItems?.[tableName] ?? [];

    if (pendingRequests.length > 0) {
      await sleep(100 * 2 ** attempt);
    }
  }
}

async function putItems(ddb, tableName, items, dryRun) {
  if (dryRun || items.length === 0) {
    return;
  }

  const chunks = chunkArray(items, BATCH_WRITE_LIMIT);

  for (const chunk of chunks) {
    await batchWriteWithRetry(ddb, tableName, chunk);
  }
}

async function main() {
  await assertLocalDemoScriptEnvironment();
  const args = parseArgs(process.argv.slice(2));
  validateArgs(args);
  const tableNames = await loadTableNames();
  const ddb = new DynamoDBClient({});
  const startSequence = await getNextProductSequence(ddb, tableNames);
  const suppliers = Array.from({ length: MAX_SUPPLIER_COUNT }, (_, index) =>
    buildFakeSupplier(index),
  );

  const products = Array.from({ length: args.products }, (_, index) =>
    buildFakeProduct(index, startSequence + index, suppliers, args.products),
  );
  const productOptions = products.flatMap((product) =>
    (product.seedOptions ?? []).map((option) => ({
      id: option.id,
      productId: product.id,
      name: option.name,
      sortOrder: option.sortOrder,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    })),
  );
  const productOptionValues = products.flatMap((product) =>
    (product.seedOptions ?? []).flatMap((option) =>
      option.values.map((value) => ({
        id: value.id,
        optionId: option.id,
        name: value.name,
        priceOffset: value.priceOffset,
        costOffset: value.costOffset,
        sortOrder: value.sortOrder,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })),
    ),
  );

  const customerOrderCounts = new Array(args.customers).fill(0);
  const customerLastOrderedAt = new Array(args.customers).fill(null);
  const provisionalCustomers = Array.from(
    { length: args.customers },
    (_, index) => buildFakeCustomer(index, 0, null),
  );

  const orders = Array.from({ length: args.orders }, (_, index) => {
    const customerIndex = weightedCustomerIndex(
      index,
      provisionalCustomers.length,
    );
    const customer = provisionalCustomers[customerIndex];
    const order = buildOrder(index, customer, products);
    customerOrderCounts[customerIndex] += 1;
    customerLastOrderedAt[customerIndex] =
      customerLastOrderedAt[customerIndex] == null ||
      customerLastOrderedAt[customerIndex] < order.createdAt
        ? order.createdAt
        : customerLastOrderedAt[customerIndex];
    return order;
  });

  const customers = provisionalCustomers.map((customer, index) => ({
    ...customer,
    orderCount: customerOrderCounts[index],
    orderCountForSort: customerOrderCounts[index],
    lastOrderedAt: customerLastOrderedAt[index],
    lastOrderedAtForSort: customerLastOrderedAt[index] ?? customer.createdAt,
  }));

  // Build shipments and associate them with orders (mutates order.shipmentId)
  const shipments = buildFakeShipments(orders);

  const customerOrderSummaries = buildCustomerOrderSummariesFromOrders({
    customers,
    orders,
  });
  const productOrderSummaries = buildProductOrderSummariesFromOrders({
    products,
    suppliers,
    orders,
  });
  const supplierOrderSummaries = buildSupplierOrderSummariesFromOrders({
    orders,
  });

  validateSeedConsistency({
    customers,
    orders,
    shipments,
    customerOrderSummaries,
    products,
    productOrderSummaries,
    supplierOrderSummaries,
  });

  await Promise.all([
    putItems(ddb, tableNames.customer, customers, args.dryRun),
    putItems(ddb, tableNames.supplier, suppliers, args.dryRun),
  ]);

  await Promise.all([
    putItems(
      ddb,
      tableNames.product,
      products.map(
        ({
          defaultSupplierName: _ignored,
          seedOptions: _seedOptions,
          ...product
        }) => product,
      ),
      args.dryRun,
    ),
    putItems(ddb, tableNames.productOption, productOptions, args.dryRun),
    putItems(
      ddb,
      tableNames.productOptionValue,
      productOptionValues,
      args.dryRun,
    ),
  ]);

  await Promise.all([
    putItems(ddb, tableNames.order, orders, args.dryRun),
    putItems(ddb, tableNames.shipment, shipments, args.dryRun),
    putItems(
      ddb,
      tableNames.customerOrderSummary,
      customerOrderSummaries,
      args.dryRun,
    ),
    putItems(
      ddb,
      tableNames.productOrderSummary,
      productOrderSummaries,
      args.dryRun,
    ),
    putItems(
      ddb,
      tableNames.supplierOrderSummary,
      supplierOrderSummaries,
      args.dryRun,
    ),
  ]);

  if (!args.dryRun) {
    await upsertSequenceCounter(
      ddb,
      tableNames.sequenceCounter,
      startSequence + products.length - 1,
    );
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        dryRun: args.dryRun,
        customers: customers.length,
        suppliers: suppliers.length,
        products: products.length,
        productOptions: productOptions.length,
        productOptionValues: productOptionValues.length,
        orders: orders.length,
        shipments: shipments.length,
        customerOrderSummaries: customerOrderSummaries.length,
        productOrderSummaries: productOrderSummaries.length,
        supplierOrderSummaries: supplierOrderSummaries.length,
        nextProductSequence: startSequence + products.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("建立假資料失敗");
  console.error(error);
  process.exit(1);
});

function resolveProductOptionTemplates(index) {
  if (index % 10 < 7) {
    return [];
  }

  const optionCount = 1 + (index % 3);
  return OPTION_TEMPLATES.slice(0, optionCount);
}

function buildProductOption(template, sortOrder) {
  return {
    id: randomUUID(),
    name: template.name,
    sortOrder,
    values: template.values.map((value, valueIndex) => ({
      id: randomUUID(),
      name: value.name,
      priceOffset: value.priceOffset,
      costOffset: value.costOffset,
      sortOrder: valueIndex,
    })),
  };
}
