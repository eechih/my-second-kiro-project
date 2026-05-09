import { defineFunction } from "@aws-amplify/backend";

export const confirmOutOfStock = defineFunction({
  name: "confirm-out-of-stock",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
