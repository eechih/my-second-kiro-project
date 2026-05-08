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
      "unitPrice",
      "defaultCost",
      "defaultSupplierId",
      "stockQuantity",
      "specDimensions",
      "imageUrls",
      "isActive",
      "version",
      "createdAt",
      "updatedAt",
      "variants.*",
    ],
  });

  return (data ?? []).map(mapProduct);
}

function mapProduct(raw: Record<string, unknown>): Product {
  let specDimensions: Product["specDimensions"] = [];
  if (raw.specDimensions) {
    try {
      specDimensions =
        typeof raw.specDimensions === "string"
          ? JSON.parse(raw.specDimensions)
          : (raw.specDimensions as Product["specDimensions"]);
    } catch {
      specDimensions = [];
    }
  }

  let variants: ProductVariant[] = [];
  if (raw.variants && Array.isArray(raw.variants)) {
    variants = (raw.variants as Record<string, unknown>[]).map(mapVariant);
  }

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sku: String(raw.sku ?? ""),
    unitPrice: Number(raw.unitPrice ?? 0),
    defaultCost: Number(raw.defaultCost ?? 0),
    defaultSupplierId: raw.defaultSupplierId ? String(raw.defaultSupplierId) : null,
    stockQuantity:
      variants.length > 0
        ? variants.reduce((sum, variant) => sum + variant.stockQuantity, 0)
        : Number(raw.stockQuantity ?? 0),
    specDimensions,
    variants,
    imageUrls: Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as string[]).filter(Boolean)
      : [],
    isActive: true,
    version: Number(raw.version ?? 1),
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function mapVariant(raw: Record<string, unknown>): ProductVariant {
  let combination: Record<string, string> = {};
  if (raw.combination) {
    try {
      combination =
        typeof raw.combination === "string"
          ? JSON.parse(raw.combination)
          : (raw.combination as Record<string, string>);
    } catch {
      combination = {};
    }
  }

  return {
    id: String(raw.id ?? ""),
    combination,
    label: String(raw.label ?? ""),
    sku: String(raw.sku ?? ""),
    stockQuantity: Number(raw.stockQuantity ?? 0),
    unitPriceOverride:
      raw.unitPriceOverride !== null && raw.unitPriceOverride !== undefined
        ? Number(raw.unitPriceOverride)
        : null,
    defaultCostOverride:
      raw.defaultCostOverride !== null && raw.defaultCostOverride !== undefined
        ? Number(raw.defaultCostOverride)
        : null,
    version: Number(raw.version ?? 1),
  };
}
