import { defineFunction } from "@aws-amplify/backend";

export const confirmShipmentDispatch = defineFunction({
  name: "confirm-shipment-dispatch",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  resourceGroupName: "data",
});
