import { defineFunction } from "@aws-amplify/backend";

export const mergeOrders = defineFunction({
  name: "merge-orders",
  entry: "./handler.ts",
  timeoutSeconds: 30,
});
