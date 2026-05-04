import { defineFunction } from "@aws-amplify/backend";

export const splitOrder = defineFunction({
  name: "split-order",
  entry: "./handler.ts",
  timeoutSeconds: 30,
});
