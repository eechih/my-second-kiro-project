import { defineFunction } from "@aws-amplify/backend";

export const cancelShipmentOrder = defineFunction({
  name: "cancel-shipment-order",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
