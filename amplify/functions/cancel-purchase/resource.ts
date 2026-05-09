import { defineFunction } from "@aws-amplify/backend";

export const cancelPurchase = defineFunction({
  name: "cancel-purchase",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
