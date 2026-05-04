import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { shipLineItem } from "./functions/ship-line-item/resource";
import { confirmReceived } from "./functions/confirm-received/resource";
import { mergeOrders } from "./functions/merge-orders/resource";
import { splitOrder } from "./functions/split-order/resource";
import { generateThumbnail } from "./functions/generate-thumbnail/resource";

defineBackend({
  auth,
  data,
  storage,
  shipLineItem,
  confirmReceived,
  mergeOrders,
  splitOrder,
  generateThumbnail,
});
