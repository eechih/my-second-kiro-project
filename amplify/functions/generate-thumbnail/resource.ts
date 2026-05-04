import { defineFunction } from "@aws-amplify/backend";

export const generateThumbnail = defineFunction({
  name: "generate-thumbnail",
  entry: "./handler.ts",
  timeoutSeconds: 60,
  memoryMB: 512,
});
