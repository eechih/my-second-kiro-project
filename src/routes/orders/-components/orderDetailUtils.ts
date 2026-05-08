import { client } from "@/lib/amplify-client";
import type { Supplier } from "@shared/models";

export const ORDER_STATUS_COLOR_MAP: Record<
  string,
  "primary" | "secondary" | "error" | "info" | "success" | "warning" | "inherit"
> = {
  pending: "warning",
  confirmed: "info",
  shipping: "primary",
  completed: "success",
  cancelled: "error",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  confirmed: "已確認",
  shipping: "出貨中",
  completed: "已完成",
  cancelled: "已取消",
};

export const LINE_ITEM_STATUS_COLOR_MAP: Record<
  string,
  "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  待處理: "warning",
  已訂購: "info",
  已收到: "primary",
  已出貨: "success",
  缺貨: "error",
};

export const PURCHASE_STATUS_LABEL: Record<string, string> = {
  pending: "待入庫",
  received: "已入庫",
  cancelled: "已取消",
};

export async function searchSuppliers(query: string): Promise<Supplier[]> {
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (query) {
    filter.or = [
      { name: { contains: query } },
      { contactPerson: { contains: query } },
    ];
  }
  const { data } = await client.models.Supplier.list({ filter, limit: 20 });
  return (data ?? []).map((raw: Record<string, unknown>) => ({
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    contactPerson: String(raw.contactPerson ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    isActive: true,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  }));
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
