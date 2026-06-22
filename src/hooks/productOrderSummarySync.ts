import { client } from "@/lib/amplify-client";
import type { Product } from "@shared/models";

const PRODUCT_ORDER_SUMMARY_DETAIL_SELECTION_SET = [
  "id",
] as const;

function buildProductOrderSummarySnapshot(
  product: Product,
  supplierName: string | null,
) {
  return {
    productNameSnapshot: product.name,
    productImageUrlSnapshot: product.imageUrls[0] ?? null,
    priceSnapshot: product.price,
    costSnapshot: product.cost,
    supplierNameSnapshot: supplierName,
  };
}

async function resolveSupplierName(
  supplierId: string | null | undefined,
): Promise<string | null> {
  if (!supplierId) {
    return null;
  }

  const { data, errors } = await client.models.Supplier.get(
    { id: supplierId },
    { selectionSet: ["id", "name"] },
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢供應商失敗");
  }

  return data?.name ? String(data.name) : null;
}

export async function syncProductOrderSummaryFromProduct(
  product: Product,
): Promise<void> {
  const supplierName = await resolveSupplierName(product.defaultSupplierId);
  const snapshot = buildProductOrderSummarySnapshot(product, supplierName);
  const { data, errors } = await client.models.ProductOrderSummary.get(
    { id: product.id },
    {
      selectionSet: PRODUCT_ORDER_SUMMARY_DETAIL_SELECTION_SET,
    },
  );

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "查詢商品採購摘要失敗");
  }

  if (data) {
    const { errors: updateErrors } = await client.models.ProductOrderSummary.update(
      {
        id: product.id,
        ...snapshot,
      },
    );

    if (updateErrors && updateErrors.length > 0) {
      throw new Error(updateErrors[0]?.message ?? "同步商品採購摘要失敗");
    }

    return;
  }

  const now = new Date().toISOString();
  const { errors: createErrors } = await client.models.ProductOrderSummary.create(
    {
      id: product.id,
      productId: product.id,
      ...snapshot,
      pendingQuantity: 0,
      orderedQuantity: 0,
      receivedQuantity: 0,
      shippedQuantity: 0,
      outOfStockQuantity: 0,
      completedQuantity: 0,
      cancelledQuantity: 0,
      totalQuantity: 0,
      gsiPartition: "ProductOrderSummary",
      createdAtForSort: now,
    },
  );

  if (createErrors && createErrors.length > 0) {
    throw new Error(createErrors[0]?.message ?? "建立商品採購摘要失敗");
  }
}
