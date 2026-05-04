import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { shipLineItem } from "./functions/ship-line-item/resource";
import { confirmReceived } from "./functions/confirm-received/resource";
import { mergeOrders } from "./functions/merge-orders/resource";
import { splitOrder } from "./functions/split-order/resource";

defineBackend({
  auth,
  data,
  shipLineItem,
  confirmReceived,
  mergeOrders,
  splitOrder,
});
