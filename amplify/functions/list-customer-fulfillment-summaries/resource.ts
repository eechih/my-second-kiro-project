import { defineFunction } from "@aws-amplify/backend";

export const getCustomerShipmentSummaries = defineFunction({
  name: "list-customer-fulfillment-summaries",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
