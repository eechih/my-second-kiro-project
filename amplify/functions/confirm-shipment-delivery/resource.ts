import { defineFunction } from "@aws-amplify/backend";

export const confirmShipmentDelivery = defineFunction({
  name: "confirm-shipment-delivery",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
