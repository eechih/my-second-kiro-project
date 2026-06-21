import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { cancelOutOfStock } from "./functions/cancel-out-of-stock/resource";
import { cancelPurchase } from "./functions/cancel-purchase/resource";
import { cancelReceived } from "./functions/cancel-received/resource";
import { cancelShipment } from "./functions/cancel-shipment/resource";
import { confirmOutOfStock } from "./functions/confirm-out-of-stock/resource";
import { confirmPurchase } from "./functions/confirm-purchase/resource";
import { confirmShipment } from "./functions/confirm-shipment/resource";
import { confirmReceived } from "./functions/confirm-received/resource";
import { createProduct } from "./functions/create-product/resource";
import { generateThumbnail } from "./functions/generate-thumbnail/resource";
import { getCustomerOrderSummaries } from "./functions/list-customer-order-summaries/resource";
import { getProductOrderSummaries } from "./functions/list-product-order-summaries/resource";
import { createShipmentFn } from "./functions/create-shipment/resource";
import { confirmShipmentDispatch } from "./functions/confirm-shipment-dispatch/resource";
import { confirmShipmentDelivery } from "./functions/confirm-shipment-delivery/resource";
import { cancelShipmentOrder } from "./functions/cancel-shipment-order/resource";
import { addOrderToShipment } from "./functions/add-order-to-shipment/resource";
import { removeOrderFromShipment } from "./functions/remove-order-from-shipment/resource";

const backend = defineBackend({
  auth,
  data,
  storage,
  cancelOutOfStock,
  cancelPurchase,
  cancelReceived,
  cancelShipment,
  confirmOutOfStock,
  confirmPurchase,
  confirmShipment,
  confirmReceived,
  createProduct,
  getCustomerOrderSummaries,
  getProductOrderSummaries,
  generateThumbnail,
  createShipmentFn,
  confirmShipmentDispatch,
  confirmShipmentDelivery,
  cancelShipmentOrder,
  addOrderToShipment,
  removeOrderFromShipment,
});

// ---------------------------------------------------------------------------
// DynamoDB 表格名稱與 IAM 權限設定
// ---------------------------------------------------------------------------
// Custom Mutation Lambda 函式需要直接存取 DynamoDB 表格（TransactWriteItems），
// 因此需要取得表格名稱並設定環境變數與 IAM 權限。

const tables = backend.data.resources.tables;

// 取得各模型對應的 DynamoDB 表格
const orderTable = tables["Order"];
const shipmentTable = tables["Shipment"];
const customerOrderSummaryTable = tables["CustomerOrderSummary"];
const productOrderSummaryTable = tables["ProductOrderSummary"];
const productTable = tables["Product"];
const productCounterTable = tables["SequenceCounter"];

if (
  !orderTable ||
  !shipmentTable ||
  !customerOrderSummaryTable ||
  !productOrderSummaryTable ||
  !productTable ||
  !productCounterTable
) {
  throw new Error(
    "缺少必要的 DynamoDB 表格定義。請確認 data schema 中已定義 Order、Shipment、CustomerOrderSummary、ProductOrderSummary、Product、SequenceCounter 模型。",
  );
}

// 匯出表格名稱至 amplify_outputs.json，供前端 Infrastructure 頁面建構 Console 連結
const tableOutputs = Object.entries(backend.data.resources.tables).reduce(
  (acc, [key, value]) => ({
    ...acc,
    [key]: { tableName: value.tableName, tableArn: value.tableArn },
  }),
  {},
);

backend.addOutput({
  custom: { tables: tableOutputs },
});

// 所有需要直接存取 DynamoDB 的 Lambda 函式
const transactionalFunctions = [
  backend.cancelOutOfStock,
  backend.cancelPurchase,
  backend.cancelReceived,
  backend.cancelShipment,
  backend.confirmOutOfStock,
  backend.confirmPurchase,
  backend.confirmShipment,
  backend.confirmReceived,
  backend.createProduct,
  backend.getCustomerOrderSummaries,
  backend.getProductOrderSummaries,
  backend.createShipmentFn,
  backend.confirmShipmentDispatch,
  backend.confirmShipmentDelivery,
  backend.cancelShipmentOrder,
  backend.addOrderToShipment,
  backend.removeOrderFromShipment,
];

for (const fn of transactionalFunctions) {
  // 需要轉型為 Function 才能使用 addEnvironment
  // Amplify Gen2 的 resources.lambda 型別為 IFunction，但實際為 Function 實例
  const lambdaFn = fn.resources.lambda as unknown as LambdaFunction;

  // 設定環境變數——傳遞 DynamoDB 表格名稱
  lambdaFn.addEnvironment("ORDER_TABLE_NAME", orderTable.tableName);
  lambdaFn.addEnvironment("SHIPMENT_TABLE_NAME", shipmentTable.tableName);
  lambdaFn.addEnvironment(
    "CUSTOMER_ORDER_SUMMARY_TABLE_NAME",
    customerOrderSummaryTable.tableName,
  );
  lambdaFn.addEnvironment(
    "PRODUCT_ORDER_SUMMARY_TABLE_NAME",
    productOrderSummaryTable.tableName,
  );
  lambdaFn.addEnvironment("PRODUCT_TABLE_NAME", productTable.tableName);
  lambdaFn.addEnvironment(
    "SEQUENCECOUNTER_TABLE_NAME",
    productCounterTable.tableName,
  );

  // 授予 DynamoDB 讀寫權限
  orderTable.grantReadWriteData(lambdaFn);
  shipmentTable.grantReadWriteData(lambdaFn);
  customerOrderSummaryTable.grantReadWriteData(lambdaFn);
  productOrderSummaryTable.grantReadWriteData(lambdaFn);
  productTable.grantReadWriteData(lambdaFn);
  productCounterTable.grantReadWriteData(lambdaFn);

  // grantReadWriteData 不包含 GSI ARN。多項流程需要 Query GSI 來進行篩選與反查。
  lambdaFn.addToRolePolicy(
    new PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [
        `${orderTable.tableArn}/index/*`,
        `${shipmentTable.tableArn}/index/*`,
        `${customerOrderSummaryTable.tableArn}/index/*`,
        `${productOrderSummaryTable.tableArn}/index/*`,
      ],
    }),
  );
}
