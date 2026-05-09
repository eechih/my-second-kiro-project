import { defineFunction } from "@aws-amplify/backend";

export const cancelShipment = defineFunction({
  name: "cancel-shipment",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
