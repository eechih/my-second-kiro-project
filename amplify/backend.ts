import { defineBackend } from "@aws-amplify/backend";
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { shipLineItem } from "./functions/ship-line-item/resource";
import { confirmReceived } from "./functions/confirm-received/resource";
import { mergeOrders } from "./functions/merge-orders/resource";
import { splitOrder } from "./functions/split-order/resource";
import { generateThumbnail } from "./functions/generate-thumbnail/resource";

const backend = defineBackend({
  auth,
  data,
  storage,
  shipLineItem,
  confirmReceived,
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
const lineItemTable = tables["LineItem"];
const productTable = tables["Product"];
const productVariantTable = tables["ProductVariant"];
const purchaseRecordTable = tables["PurchaseRecord"];

if (
  !orderTable ||
  !lineItemTable ||
  !productTable ||
  !productVariantTable ||
  !purchaseRecordTable
) {
  throw new Error(
    "缺少必要的 DynamoDB 表格定義。請確認 data schema 中已定義 Order、LineItem、Product、ProductVariant、PurchaseRecord 模型。",
  );
}

// 所有需要直接存取 DynamoDB 的 Lambda 函式
const transactionalFunctions = [
  backend.shipLineItem,
  backend.confirmReceived,
  backend.mergeOrders,
  backend.splitOrder,
];

for (const fn of transactionalFunctions) {
  // 需要轉型為 Function 才能使用 addEnvironment
  // Amplify Gen2 的 resources.lambda 型別為 IFunction，但實際為 Function 實例
  const lambdaFn = fn.resources.lambda as unknown as LambdaFunction;

  // 設定環境變數——傳遞 DynamoDB 表格名稱
  lambdaFn.addEnvironment("ORDER_TABLE_NAME", orderTable.tableName);
  lambdaFn.addEnvironment("LINEITEM_TABLE_NAME", lineItemTable.tableName);
  lambdaFn.addEnvironment("PRODUCT_TABLE_NAME", productTable.tableName);
  lambdaFn.addEnvironment(
    "PRODUCTVARIANT_TABLE_NAME",
    productVariantTable.tableName,
  );
  lambdaFn.addEnvironment(
    "PURCHASERECORD_TABLE_NAME",
    purchaseRecordTable.tableName,
  );

  // 授予 DynamoDB 讀寫權限
  orderTable.grantReadWriteData(lambdaFn);
  lineItemTable.grantReadWriteData(lambdaFn);
  productTable.grantReadWriteData(lambdaFn);
  productVariantTable.grantReadWriteData(lambdaFn);
  purchaseRecordTable.grantReadWriteData(lambdaFn);
}
