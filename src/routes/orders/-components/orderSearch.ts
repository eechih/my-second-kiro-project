import { client } from "@/lib/amplify-client";
import type { Customer, Product, ProductVariant } from "@shared/models";

export async function searchCustomers(query: string): Promise<Customer[]> {
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (query) {
    filter.or = [
      { name: { contains: query } },
      { contactPerson: { contains: query } },
    ];
  }

  const { data } = await client.models.Customer.list({
    filter,
    limit: 20,
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

export async function searchProducts(query: string): Promise<Product[]> {
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (query) {
    filter.or = [{ name: { contains: query } }, { sku: { contains: query } }];
  }

  const { data } = await client.models.Product.list({
    filter,
    limit: 20,
    selectionSet: [
      "id",
      "name",
      "sku",
      "price",
      "cost",
      "defaultSupplierId",
      "stockQuantity",
      "imageUrls",
      "isActive",
      "createdAt",
      "updatedAt",
      "variants.*",
    ],
  });

  return (data ?? []).map(mapProduct);
}

function mapProduct(raw: Record<string, unknown>): Product {
  let variants: ProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    variants = (raw.variants as Record<string, unknown>[]).map(mapVariant);
  }

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sku: String(raw.sku ?? ""),
    price: Number(raw.price ?? 0),
    cost: Number(raw.cost ?? 0),
    defaultSupplierId: raw.defaultSupplierId ? String(raw.defaultSupplierId) : null,
    stockQuantity: Number(raw.stockQuantity ?? 0),
    variants,
    imageUrls: Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as string[]).filter(Boolean)
      : [],
    isActive: true,
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
