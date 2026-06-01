import { client } from "@/lib/amplify-client";
import { ACTIVE_STATUS, deriveProductActiveState } from "@shared/models";
import type {
  Customer,
  Product,
  ProductOption,
  ProductOptionValue,
} from "@shared/models";

const SEARCH_LIMIT = 50;
const CUSTOMER_LIST_LIMIT = 50;

const PRODUCT_SELECTION_SET = [
  "id",
  "name",
  "sku",
  "sequenceNumber",
  "description",
  "price",
  "cost",
  "defaultSupplierId",
  "stockQuantity",
  "imageUrls",
  "isActive",
  "preorderStatus",
  "preorderCloseAt",
  "createdAt",
  "updatedAt",
  "options.*",
  "options.values.*",
] as const;

export async function searchCustomers(query: string): Promise<Customer[]> {
  const trimmedQuery = query.trim();
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (trimmedQuery) {
    filter.or = [
      { name: { contains: trimmedQuery } },
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

export async function listCustomers(): Promise<Customer[]> {
  const { data, errors } =
    await client.models.Customer.listActiveCustomersByOrderCount(
      { activeStatusKey: ACTIVE_STATUS.active },
      {
        sortDirection: "DESC",
        limit: CUSTOMER_LIST_LIMIT,
      } as Record<string, unknown>,
    );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "載入客戶失敗");
  }

  return (data ?? []).map(mapCustomer);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return listProducts();
  }

  const normalizedSkuQuery = trimmedQuery.toUpperCase();
  const exactSequenceMatches = await searchProductsBySequenceNumber(trimmedQuery);
  const fuzzyMatches = await queryActiveProducts({
    filter: {
      or: [
        { sku: { eq: normalizedSkuQuery } },
        { name: { contains: trimmedQuery } },
        { sku: { contains: trimmedQuery } },
      ],
    },
  });

  return dedupeProductsById([...exactSequenceMatches, ...fuzzyMatches]).slice(
    0,
    SEARCH_LIMIT,
  );
}

export async function searchProductsBySequenceNumber(
  query: string | number,
): Promise<Product[]> {
  const normalizedQuery =
    typeof query === "number" ? String(query) : query.trim();

  if (!/^\d+$/.test(normalizedQuery)) {
    return [];
  }

  return queryActiveProducts({
    filter: {
      sequenceNumber: {
        eq: Number.parseInt(normalizedQuery, 10),
      },
    },
  });
}

export async function listProducts(): Promise<Product[]> {
  return queryActiveProducts();
}

async function queryActiveProducts(options?: {
  filter?: Record<string, unknown>;
  limit?: number;
}): Promise<Product[]> {
  const { data, errors } =
    await client.models.Product.listActiveProductsByCreatedDate(
      { activeStatusKey: ACTIVE_STATUS.active },
      {
        sortDirection: "DESC",
        limit: options?.limit ?? SEARCH_LIMIT,
        selectionSet: PRODUCT_SELECTION_SET,
        ...(options?.filter ? { filter: options.filter } : {}),
      } as Record<string, unknown>,
    );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "搜尋商品失敗");
  }

  return (data ?? []).map(mapProduct);
}

function dedupeProductsById(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }
    seen.add(product.id);
    return true;
  });
}

function mapCustomer(raw: Record<string, unknown>): Customer {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    isActive: raw.isActive !== false,
    orderCount: Number(raw.orderCount ?? 0),
    lastOrderedAt: raw.lastOrderedAt ? String(raw.lastOrderedAt) : null,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function mapProduct(raw: Record<string, unknown>): Product {
  let options: ProductOption[] = [];
  if (raw.options && Array.isArray(raw.options)) {
    options = (raw.options as Record<string, unknown>[]).map(mapOption);
  }

  options.sort((a, b) => a.sortOrder - b.sortOrder);

  const preorderStatus = raw.preorderStatus
    ? (String(raw.preorderStatus) as Product["preorderStatus"])
    : null;
  const derivedActiveState = deriveProductActiveState(preorderStatus);

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sku: String(raw.sku ?? ""),
    sequenceNumber: Number(raw.sequenceNumber ?? 0),
    description: String(raw.description ?? ""),
    price: Number(raw.price ?? 0),
    cost: Number(raw.cost ?? 0),
    defaultSupplierId: raw.defaultSupplierId ? String(raw.defaultSupplierId) : null,
    stockQuantity: Number(raw.stockQuantity ?? 0),
    options,
    imageUrls: Array.isArray(raw.imageUrls)
      ? (raw.imageUrls as string[]).filter(Boolean)
      : [],
    isActive: derivedActiveState.isActive,
    preorderStatus,
    preorderCloseAt: raw.preorderCloseAt
      ? String(raw.preorderCloseAt)
      : null,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function mapOptionValue(raw: Record<string, unknown>): ProductOptionValue {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    priceOffset: Number(raw.priceOffset ?? 0),
    costOffset: Number(raw.costOffset ?? 0),
    sortOrder: Number(raw.sortOrder ?? 0),
  };
}

function mapOption(raw: Record<string, unknown>): ProductOption {
  let values: ProductOptionValue[] = [];
  if (raw.values && Array.isArray(raw.values)) {
    values = (raw.values as Record<string, unknown>[]).map(mapOptionValue);
  }

  values.sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    sortOrder: Number(raw.sortOrder ?? 0),
    values,
  };
}
