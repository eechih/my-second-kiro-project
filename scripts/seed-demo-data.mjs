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
    status: "PENDING_PAYMENT",
    paymentStatus: "UNPAID",
    fulfillmentStatus: "UNFULFILLED",
    itemStatus: "pending",
    timeline: "pending_payment",
  },
  {
    status: "PAID",
    paymentStatus: "PAID",
    fulfillmentStatus: "UNFULFILLED",
    itemStatus: "ordered",
    timeline: "paid_unfulfilled",
  },
  {
    status: "PAID",
    paymentStatus: "PAID",
    fulfillmentStatus: "READY_TO_SHIP",
    itemStatus: "received",
    timeline: "ready_to_ship",
  },
  {
    status: "PAID",
    paymentStatus: "PAID",
    fulfillmentStatus: "SHIPPED",
    itemStatus: "shipped",
    timeline: "shipped",
  },
  {
    status: "COMPLETED",
    paymentStatus: "PAID",
    fulfillmentStatus: "COMPLETED",
    itemStatus: "shipped",
    timeline: "completed",
  },
  {
    status: "CANCELLED",
    paymentStatus: "UNPAID",
    fulfillmentStatus: "UNFULFILLED",
    itemStatus: "pending",
    timeline: "cancelled",
  },
  {
    status: "REFUNDED",
    paymentStatus: "REFUNDED",
    fulfillmentStatus: "COMPLETED",
    itemStatus: "shipped",
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

const CITY_NAMES = [
  "台北市",
  "新北市",
  "桃園市",
  "台中市",
  "台南市",
  "高雄市",
];

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

function offsetIso(dateString, offsetHours) {
  return new Date(new Date(dateString).getTime() + offsetHours * 3600000)
    .toISOString();
}

function weightedCustomerIndex(orderIndex, customerCount) {
  const favoredPool = Math.max(5, Math.floor(customerCount * 0.35));
  if (orderIndex % 5 === 0) {
    return orderIndex % customerCount;
  }
  return orderIndex % favoredPool;
}

function buildFakeCustomerName(index) {
  const label = String(index + 1).padStart(3, "0");

  if (index % 5 === 0) {
    const prefix = Random.pick(CUSTOMER_STORE_PREFIXES);
    const suffix = Random.pick(CUSTOMER_STORE_SUFFIXES);
    return `${prefix}${suffix} ${label}`;
  }

  const surname = Random.pick(CUSTOMER_SURNAMES);
  const givenName = Random.pick(CUSTOMER_GIVEN_NAMES);
  return `${surname}${givenName} ${label}`;
}

function buildFakeCustomer(index, orderCount, lastOrderedAt) {
  const city = Random.pick(CITY_NAMES);
  const createdAt = new Date(Date.now() - (index + 14) * 86400000).toISOString();
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

function buildOrderItemTimeline(createdAt, itemStatus) {
  const purchasedAt =
    itemStatus === "pending" ? null : offsetIso(createdAt, 6);
  const receivedAt =
    itemStatus === "received" || itemStatus === "shipped"
      ? offsetIso(createdAt, 30)
      : null;
  const shippedAt =
    itemStatus === "shipped" ? offsetIso(createdAt, 54) : null;
  const outOfStockAt =
    itemStatus === "out_of_stock" ? offsetIso(createdAt, 12) : null;

  return {
    purchasedAt,
    receivedAt,
    shippedAt,
    outOfStockAt,
  };
}

function buildOrderTimeline(createdAt, scenario) {
  switch (scenario.timeline) {
    case "pending_payment":
      return {
        paidAt: null,
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
    case "paid_unfulfilled":
      return {
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
    case "ready_to_ship":
      return {
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
    case "shipped":
      return {
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: null,
        completedAt: null,
      };
    case "completed":
      return {
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: null,
        completedAt: offsetIso(createdAt, 72),
      };
    case "cancelled":
      return {
        paidAt: null,
        cancelledAt: offsetIso(createdAt, 4),
        refundedAt: null,
        completedAt: null,
      };
    case "refunded":
      return {
        paidAt: offsetIso(createdAt, 2),
        cancelledAt: null,
        refundedAt: offsetIso(createdAt, 96),
        completedAt: null,
      };
    default:
      return {
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
      toStatus: "PENDING_PAYMENT",
      changedAt: createdAt,
    },
  ];

  if (scenario.status === "PENDING_PAYMENT") {
    return history;
  }

  if (timeline.paidAt) {
    history.push({
      fromStatus: "PENDING_PAYMENT",
      toStatus: "PAID",
      changedAt: timeline.paidAt,
    });
  }

  if (scenario.status === "CANCELLED" && timeline.cancelledAt) {
    history.push({
      fromStatus: "PENDING_PAYMENT",
      toStatus: "CANCELLED",
      changedAt: timeline.cancelledAt,
    });
  }

  if (scenario.status === "COMPLETED" && timeline.completedAt) {
    history.push({
      fromStatus: "PAID",
      toStatus: "COMPLETED",
      changedAt: timeline.completedAt,
    });
  }

  if (scenario.status === "REFUNDED" && timeline.refundedAt) {
    history.push({
      fromStatus: "PAID",
      toStatus: "REFUNDED",
      changedAt: timeline.refundedAt,
    });
  }

  return history;
}

function buildFakeSupplier(index) {
  const createdAt = new Date(Date.now() - (index + 21) * 86400000).toISOString();
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
  const preorderStatus =
    index % 10 < 7 ? "OPEN" : "CLOSED";
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

function buildOrderItem(
  product,
  quantity,
  createdAt,
  itemStatus,
  supplierName,
) {
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
  const timeline = buildOrderItemTimeline(createdAt, itemStatus);
  return {
    id: randomUUID(),
    productId: product.id,
    status: itemStatus,
    productNameSnapshot: product.name,
    productSkuSnapshot: product.sku,
    productImageUrlSnapshot: null,
    selectedOptionsSnapshot,
    unitPriceSnapshot: unitPrice,
    unitCostSnapshot: unitCost,
    quantity,
    totalPriceSnapshot: unitPrice * quantity,
    totalCostSnapshot: unitCost * quantity,
    supplierName,
    purchasedAt: timeline.purchasedAt,
    receivedAt: timeline.receivedAt,
    shippedAt: timeline.shippedAt,
    outOfStockAt: timeline.outOfStockAt,
    createdAtForSort: createdAt,
    createdAt,
    updatedAt:
      timeline.outOfStockAt ??
      timeline.shippedAt ??
      timeline.receivedAt ??
      timeline.purchasedAt ??
      createdAt,
  };
}

function buildOrder(orderIndex, customer, products) {
  const statusConfig = ORDER_SCENARIOS[orderIndex % ORDER_SCENARIOS.length];
  const createdAt = new Date(
    Date.now() - (orderIndex + 1) * 21600000,
  ).toISOString();
  const itemCount = resolveOrderItemCount(orderIndex);
  const usedProducts = [];

  for (let offset = 0; offset < itemCount; offset += 1) {
    usedProducts.push(products[(orderIndex * 2 + offset) % products.length]);
  }

  const items = usedProducts.map((product, itemIndex) =>
    buildOrderItem(
      product,
      1 + ((orderIndex + itemIndex) % 4),
      createdAt,
      statusConfig.itemStatus,
      product.defaultSupplierName ?? null,
    ),
  );

  const subtotalAmount = items.reduce(
    (sum, item) => sum + item.totalPriceSnapshot,
    0,
  );
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
    ...items.map((item) => item.updatedAt),
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
    status: statusConfig.status,
    paymentStatus: statusConfig.paymentStatus,
    fulfillmentStatus: statusConfig.fulfillmentStatus,
    paidAt: timeline.paidAt,
    cancelledAt: timeline.cancelledAt,
    refundedAt: timeline.refundedAt,
    completedAt: timeline.completedAt,
    subtotalAmount,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: subtotalAmount,
    note: "Seed demo order",
    statusHistory,
    isActive: true,
    deletedAt: null,
    gsiPartition: "Order",
    createdAtForSort: createdAt,
    createdAt,
    updatedAt,
    items,
  };
}

function buildCustomerFulfillmentSummaries(customers, orders) {
  const summaryByCustomerId = new Map();

  for (const order of orders) {
    const customerId = order.customerId;
    if (!customerId) {
      continue;
    }

    const customerNameSnapshot = order.customerNameSnapshot ?? "未命名客戶";
    const totalItemCount = order.items.reduce(
      (sum, item) => sum + Number(item.quantity ?? 0),
      0,
    );
    const latestReadyToShipReceivedAt = order.items
      .filter((item) => item.receivedAt)
      .reduce(
        (latest, item) =>
          latest && latest > item.receivedAt ? latest : item.receivedAt,
        null,
      );
    const isPending = order.fulfillmentStatus === "UNFULFILLED";
    const isReadyToShip = order.fulfillmentStatus === "READY_TO_SHIP";
    const isShipped =
      order.fulfillmentStatus === "SHIPPED" ||
      order.fulfillmentStatus === "COMPLETED";
    const pendingItemCount = isPending ? totalItemCount : 0;
    const readyToShipItemCount = isReadyToShip ? totalItemCount : 0;
    const shippedItemCount = isShipped ? totalItemCount : 0;

    if (
      !isPending &&
      !isReadyToShip &&
      !isShipped &&
      pendingItemCount === 0 &&
      readyToShipItemCount === 0 &&
      shippedItemCount === 0
    ) {
      continue;
    }

    const existing = summaryByCustomerId.get(customerId) ?? {
      id: customerId,
      customerId,
      customerNameSnapshot,
      pendingOrderCount: 0,
      pendingItemCount: 0,
      readyToShipOrderCount: 0,
      readyToShipItemCount: 0,
      latestReadyToShipReceivedAt: null,
      shippedOrderCount: 0,
      shippedItemCount: 0,
      completedOrderCount: 0,
      totalOrderCount: 0,
      gsiPartition: "CustomerFulfillmentSummary",
      createdAtForSort: order.createdAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };

    summaryByCustomerId.set(customerId, {
      ...existing,
      customerNameSnapshot,
      pendingOrderCount: existing.pendingOrderCount + (isPending ? 1 : 0),
      pendingItemCount: existing.pendingItemCount + pendingItemCount,
      readyToShipOrderCount:
        existing.readyToShipOrderCount + (isReadyToShip ? 1 : 0),
      readyToShipItemCount:
        existing.readyToShipItemCount + readyToShipItemCount,
      latestReadyToShipReceivedAt:
        existing.latestReadyToShipReceivedAt &&
        latestReadyToShipReceivedAt
          ? existing.latestReadyToShipReceivedAt > latestReadyToShipReceivedAt
            ? existing.latestReadyToShipReceivedAt
            : latestReadyToShipReceivedAt
          : (existing.latestReadyToShipReceivedAt ?? latestReadyToShipReceivedAt),
      shippedOrderCount: existing.shippedOrderCount + (isShipped ? 1 : 0),
      shippedItemCount: existing.shippedItemCount + shippedItemCount,
      completedOrderCount:
        existing.completedOrderCount + (order.status === "COMPLETED" ? 1 : 0),
      totalOrderCount: existing.totalOrderCount + 1,
      createdAtForSort:
        existing.createdAtForSort < order.createdAt
          ? existing.createdAtForSort
          : order.createdAt,
      createdAt:
        existing.createdAt < order.createdAt ? existing.createdAt : order.createdAt,
      updatedAt:
        existing.updatedAt > order.updatedAt ? existing.updatedAt : order.updatedAt,
    });
  }

  return customers
    .map((customer) => summaryByCustomerId.get(customer.id))
    .filter(Boolean);
}

async function loadTableNames() {
  const raw = await readFile(new URL("../amplify_outputs.json", import.meta.url), "utf8");
  const outputs = JSON.parse(raw);
  const tables = outputs?.custom?.tables ?? {};

  const tableNames = {
    customer: tables.Customer?.tableName,
    supplier: tables.Supplier?.tableName,
    product: tables.Product?.tableName,
    productOption: tables.ProductOption?.tableName,
    productOptionValue: tables.ProductOptionValue?.tableName,
    order: tables.Order?.tableName,
    orderItem: tables.OrderItem?.tableName,
    customerFulfillmentSummary: tables.CustomerFulfillmentSummary?.tableName,
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
  const provisionalCustomers = Array.from({ length: args.customers }, (_, index) =>
    buildFakeCustomer(index, 0, null),
  );

  const orders = Array.from({ length: args.orders }, (_, index) => {
    const customerIndex = weightedCustomerIndex(index, provisionalCustomers.length);
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

  const orderItems = orders.flatMap((order) =>
    order.items.map((item) => ({
      ...item,
      orderId: order.id,
    })),
  );
  const customerFulfillmentSummaries = buildCustomerFulfillmentSummaries(
    customers,
    orders,
  );

  await Promise.all([
    putItems(ddb, tableNames.customer, customers, args.dryRun),
    putItems(ddb, tableNames.supplier, suppliers, args.dryRun),
  ]);

  await Promise.all([
    putItems(
      ddb,
      tableNames.product,
      products.map(
        ({ defaultSupplierName: _ignored, seedOptions: _seedOptions, ...product }) =>
          product,
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
    putItems(
      ddb,
      tableNames.order,
      orders.map(({ items, ...order }) => order),
      args.dryRun,
    ),
    putItems(
      ddb,
      tableNames.orderItem,
      orderItems.map(({ defaultSupplierName: _ignored, ...item }) => item),
      args.dryRun,
    ),
    putItems(
      ddb,
      tableNames.customerFulfillmentSummary,
      customerFulfillmentSummaries,
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
        orderItems: orderItems.length,
        customerFulfillmentSummaries: customerFulfillmentSummaries.length,
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

function resolveOrderItemCount(orderIndex) {
  if (orderIndex % 10 < 7) {
    return 1;
  }

  return 2 + (orderIndex % 9);
}
