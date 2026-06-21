import { defineFunction } from "@aws-amplify/backend";

export const addOrderToShipment = defineFunction({
  name: "add-order-to-shipment",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
