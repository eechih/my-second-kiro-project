import { defineFunction } from "@aws-amplify/backend";

export const createShipmentFn = defineFunction({
  name: "create-shipment",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
