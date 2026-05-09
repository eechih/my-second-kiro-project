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
  pending: "warning",
  ordered: "info",
  received: "primary",
  shipped: "success",
  out_of_stock: "error",
};

export async function searchSuppliers(query: string): Promise<Supplier[]> {
  const filter: Record<string, unknown> = {};
  const conditions: Record<string, unknown>[] = [{ isActive: { eq: true } }];

  if (query) {
    conditions.push({
      or: [
        { name: { contains: query } },
        { contactPerson: { contains: query } },
      ],
    });
  }

  if (conditions.length === 1) {
    Object.assign(filter, conditions[0]);
  } else {
    filter.and = conditions;
  }

  const { data } = await client.models.Supplier.list({
    filter,
    limit: 20,
    selectionSet: [
      "id",
      "name",
      "contactPerson",
      "phone",
      "email",
      "address",
      "isActive",
      "createdAt",
      "updatedAt",
    ],
  });
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
