import { defineFunction } from "@aws-amplify/backend";

export const confirmShipment = defineFunction({
  name: "confirm-shipment",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
