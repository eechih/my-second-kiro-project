import { defineFunction } from "@aws-amplify/backend";

export const confirmReceived = defineFunction({
  name: "confirm-received",
  entry: "./handler.ts",
  timeoutSeconds: 30,
});
