import { defineFunction } from "@aws-amplify/backend";

export const cancelReceived = defineFunction({
  name: "cancel-received",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
