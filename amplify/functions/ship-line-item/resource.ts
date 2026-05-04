import { defineFunction } from "@aws-amplify/backend";

export const shipLineItem = defineFunction({
  name: "ship-line-item",
  entry: "./handler.ts",
  timeoutSeconds: 30,
});
