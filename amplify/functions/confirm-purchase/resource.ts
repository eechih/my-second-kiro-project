import { defineFunction } from "@aws-amplify/backend";

export const confirmPurchase = defineFunction({
  name: "confirm-purchase",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
