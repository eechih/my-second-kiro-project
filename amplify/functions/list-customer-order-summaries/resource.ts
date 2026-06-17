import { defineFunction } from "@aws-amplify/backend";

export const getCustomerOrderSummaries = defineFunction({
  name: "list-customer-order-summaries",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
