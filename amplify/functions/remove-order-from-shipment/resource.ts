import { defineFunction } from "@aws-amplify/backend";

export const removeOrderFromShipment = defineFunction({
  name: "remove-order-from-shipment",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
