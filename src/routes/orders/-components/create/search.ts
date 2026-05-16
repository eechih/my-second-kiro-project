import { client } from "@/lib/amplify-client";
import type { Customer, Product, ProductVariant } from "@shared/models";

const SEARCH_LIMIT = 20;

const PRODUCT_SELECTION_SET = [
  "id",
  "name",
  "sku",
  "description",
  "price",
  "cost",
  "defaultSupplierId",
  "stockQuantity",
  "imageUrls",
  "isActive",
  "createdAt",
  "updatedAt",
  "variants.*",
] as const;

export async function searchCustomers(query: string): Promise<Customer[]> {
  const trimmedQuery = query.trim();
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (trimmedQuery) {
    filter.or = [
      { name: { contains: trimmedQuery } },
      { contactPerson: { contains: trimmedQuery } },
      { phone: { contains: trimmedQuery } },
    ];
  }

  const { data, errors } = await client.models.Customer.list({
    filter,
    limit: SEARCH_LIMIT,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "搜尋客戶失敗");
  }

  return (data ?? []).map(mapCustomer);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const trimmedQuery = query.trim();
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (trimmedQuery) {
    filter.or = [
      { name: { contains: trimmedQuery } },
      { sku: { contains: trimmedQuery } },
    ];
  }

  const { data, errors } = await client.models.Product.list({
    filter,
    limit: SEARCH_LIMIT,
    selectionSet: PRODUCT_SELECTION_SET,
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "搜尋商品失敗");
  }

  return (data ?? []).map(mapProduct);
}

function mapCustomer(raw: Record<string, unknown>): Customer {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    contactPerson: String(raw.contactPerson ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function mapProduct(raw: Record<string, unknown>): Product {
  let variants: ProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    variants = (raw.variants as Record<string, unknown>[]).map(mapVariant);
  }

  variants.sort((a, b) => a.label.localeCompare(b.label, "zh-TW"));

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sku: String(raw.sku ?? ""),
    description: String(raw.description ?? ""),
    price: Number(raw.price ?? 0),
    cost: Number(raw.cost ?? 0),
    defaultSupplierId: raw.defaultSupplierId ? String(raw.defaultSupplierId) : null,
    stockQuantity: Number(raw.stockQuantity ?? 0),
    variants,
    imageUrls: Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as string[]).filter(Boolean)
      : [],
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function mapVariant(raw: Record<string, unknown>): ProductVariant {
  return {
    id: String(raw.id ?? ""),
    label: String(raw.label ?? ""),
    priceOffset:
      raw.priceOffset !== null && raw.priceOffset !== undefined
        ? Number(raw.priceOffset)
        : null,
    costOffset:
      raw.costOffset !== null && raw.costOffset !== undefined
        ? Number(raw.costOffset)
        : null,
  };
}
