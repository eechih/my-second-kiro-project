import type { Schema } from "../../data/resource";
import {
  type AttributeValue,
  DynamoDBClient,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { normalizeCustomerOrderSummary } from "@shared/models/customer-order-summary";

const ddb = new DynamoDBClient({});
const SUMMARY_INDEX_NAME = "byCreatedAt";
const SUMMARY_PARTITION = "CustomerOrderSummary";

export const handler: Schema["getCustomerOrderSummaries"]["functionHandler"] =
  async () => {
    const summaryTable = process.env["CUSTOMER_ORDER_SUMMARY_TABLE_NAME"];

    if (!summaryTable) {
      throw new Error("缺少必要的環境變數設定");
    }

    const items: NonNullable<
      ReturnType<typeof normalizeCustomerOrderSummary>
    >[] = [];
    let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

    do {
      const result = await ddb.send(
        new QueryCommand({
          TableName: summaryTable,
          IndexName: SUMMARY_INDEX_NAME,
          KeyConditionExpression: "#partition = :partition",
          ExpressionAttributeNames: {
            "#partition": "gsiPartition",
          },
          ExpressionAttributeValues: {
            ":partition": { S: SUMMARY_PARTITION },
          },
          ScanIndexForward: false,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      for (const rawItem of result.Items ?? []) {
        const normalized = normalizeCustomerOrderSummary(
          unmarshall(rawItem) as Record<string, unknown>,
        );

        if (normalized) {
          items.push(normalized);
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return JSON.stringify({ items });
  };
