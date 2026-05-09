import { client } from "@/lib/amplify-client";
import { ORDER_STATUS_LABEL } from "@shared/models";
import type { OrderStatus, Supplier } from "@shared/models";

export const ORDER_STATUS_COLOR_MAP: Record<
  OrderStatus,
  "primary" | "secondary" | "error" | "info" | "success" | "warning"
> = {
  pending: "warning",
  confirmed: "info",
  shipping: "primary",
  completed: "success",
  cancelled: "error",
};

export { ORDER_STATUS_LABEL };

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
