import { defineFunction } from "@aws-amplify/backend";

export const getProductOrderSummaries = defineFunction({
  name: "list-product-order-summaries",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
