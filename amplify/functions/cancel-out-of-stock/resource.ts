import { defineFunction } from "@aws-amplify/backend";

export const cancelOutOfStock = defineFunction({
  name: "cancel-out-of-stock",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
