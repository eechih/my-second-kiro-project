import { ORDER_STATUS_LABEL } from "@shared/models";

export { ORDER_STATUS_LABEL };

export const ORDER_ITEM_STATUS_COLOR: Record<
  string,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  PENDING: "warning",
  ORDERED: "info",
  RECEIVED: "primary",
  SHIPPED: "success",
  OUT_OF_STOCK: "error",
};

export function formatOrderDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatOrderTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}
