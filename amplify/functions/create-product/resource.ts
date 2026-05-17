import { defineFunction } from "@aws-amplify/backend";

export const createProduct = defineFunction({
  name: "create-product",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
