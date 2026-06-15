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
import { mergeOrders } from "./functions/merge-orders/resource";
import { splitOrder } from "./functions/split-order/resource";
import { generateThumbnail } from "./functions/generate-thumbnail/resource";

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
  mergeOrders,
  splitOrder,
  generateThumbnail,
});

// ---------------------------------------------------------------------------
// DynamoDB 表格名稱與 IAM 權限設定
// ---------------------------------------------------------------------------
// Custom Mutation Lambda 函式需要直接存取 DynamoDB 表格（TransactWriteItems），
// 因此需要取得表格名稱並設定環境變數與 IAM 權限。

const tables = backend.data.resources.tables;

// 取得各模型對應的 DynamoDB 表格
const orderTable = tables["Order"];
const orderItemTable = tables["OrderItem"];
const customerFulfillmentSummaryTable = tables["CustomerFulfillmentSummary"];
const productTable = tables["Product"];
const productCounterTable = tables["SequenceCounter"];

if (
  !orderTable ||
  !orderItemTable ||
  !customerFulfillmentSummaryTable ||
  !productTable ||
  !productCounterTable
) {
  throw new Error(
    "缺少必要的 DynamoDB 表格定義。請確認 data schema 中已定義 Order、OrderItem、CustomerFulfillmentSummary、Product、SequenceCounter 模型。",
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
  backend.mergeOrders,
  backend.splitOrder,
];

for (const fn of transactionalFunctions) {
  // 需要轉型為 Function 才能使用 addEnvironment
  // Amplify Gen2 的 resources.lambda 型別為 IFunction，但實際為 Function 實例
  const lambdaFn = fn.resources.lambda as unknown as LambdaFunction;

  // 設定環境變數——傳遞 DynamoDB 表格名稱
  lambdaFn.addEnvironment("ORDER_TABLE_NAME", orderTable.tableName);
  lambdaFn.addEnvironment("ORDER_ITEM_TABLE_NAME", orderItemTable.tableName);
  lambdaFn.addEnvironment(
    "CUSTOMER_FULFILLMENT_SUMMARY_TABLE_NAME",
    customerFulfillmentSummaryTable.tableName,
  );
  lambdaFn.addEnvironment("PRODUCT_TABLE_NAME", productTable.tableName);
  lambdaFn.addEnvironment(
    "SEQUENCECOUNTER_TABLE_NAME",
    productCounterTable.tableName,
  );

  // 授予 DynamoDB 讀寫權限
  orderTable.grantReadWriteData(lambdaFn);
  orderItemTable.grantReadWriteData(lambdaFn);
  customerFulfillmentSummaryTable.grantReadWriteData(lambdaFn);
  productTable.grantReadWriteData(lambdaFn);
  productCounterTable.grantReadWriteData(lambdaFn);

  // grantReadWriteData does not include GSI ARNs. Several order workflow
  // functions query OrderItem.byOrderId directly to derive order state.
  lambdaFn.addToRolePolicy(
    new PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [`${orderItemTable.tableArn}/index/*`],
    }),
  );
}
