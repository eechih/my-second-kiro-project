import { client } from "@/lib/amplify-client";

const SUPPLIER_ORDER_ITEM_SELECTION_SET = [
  "id",
  "quantity",
  "status",
  "purchasedAt",
  "receivedAt",
  "updatedAt",
  "createdAt",
  "createdAtForSort",
] as const;

function getLatestActivityAt(item: Record<string, unknown>): string | null {
  const value =
    item.updatedAt ??
    item.receivedAt ??
    item.purchasedAt ??
    item.createdAtForSort ??
    item.createdAt ??
    null;

  return value != null ? String(value) : null;
}

async function fetchSupplierOrderItems(
  supplierName: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let nextToken: string | null | undefined;

  do {
    const { data, errors, nextToken: responseNextToken } =
      await client.models.OrderItem.list({
        filter: {
          and: [
            { supplierName: { eq: supplierName } },
            {
              or: [{ status: { eq: "ordered" } }, { status: { eq: "received" } }],
            },
          ],
        },
        limit: 200,
        nextToken: nextToken ?? undefined,
        selectionSet: SUPPLIER_ORDER_ITEM_SELECTION_SET,
      });

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "查詢供應商入庫摘要失敗");
    }

    items.push(
      ...((data ?? []) as unknown as Record<string, unknown>[]),
    );
    nextToken = responseNextToken;
  } while (nextToken);

  return items;
}

export async function syncSupplierOrderSummaryBySupplierName(
  supplierName: string | null | undefined,
): Promise<void> {
  const trimmedSupplierName = String(supplierName ?? "").trim();

  if (!trimmedSupplierName) {
    return;
  }

  const items = await fetchSupplierOrderItems(trimmedSupplierName);
  const { data: existingSummary, errors: summaryErrors } =
    await client.models.SupplierOrderSummary.get({ id: trimmedSupplierName });

  if (summaryErrors && summaryErrors.length > 0) {
    throw new Error(summaryErrors[0]?.message ?? "查詢供應商入庫摘要失敗");
  }

  if (items.length === 0) {
    if (existingSummary) {
      const { errors } = await client.models.SupplierOrderSummary.delete({
        id: trimmedSupplierName,
      });

      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "刪除供應商入庫摘要失敗");
      }
    }

    return;
  }

  const aggregate = items.reduce(
    (acc, item) => {
      const status = String(item.status ?? "");
      const quantity = Number(item.quantity ?? 0);
      const latestActivityAt = getLatestActivityAt(item);

      if (status === "ordered") {
        acc.orderedQuantity += quantity;
      }

      if (status === "received") {
        acc.receivedQuantity += quantity;
      }

      acc.totalQuantity += quantity;
      acc.latestActivityAt =
        latestActivityAt &&
        (!acc.latestActivityAt || latestActivityAt > acc.latestActivityAt)
          ? latestActivityAt
          : acc.latestActivityAt;

      return acc;
    },
    {
      orderedQuantity: 0,
      receivedQuantity: 0,
      totalQuantity: 0,
      latestActivityAt: null as string | null,
    },
  );

  const payload = {
    supplierNameSnapshot: trimmedSupplierName,
    orderedQuantity: aggregate.orderedQuantity,
    receivedQuantity: aggregate.receivedQuantity,
    totalQuantity: aggregate.totalQuantity,
    latestActivityAt: aggregate.latestActivityAt,
    createdAtForSort: aggregate.latestActivityAt ?? new Date().toISOString(),
  };

  if (existingSummary) {
    const { errors } = await client.models.SupplierOrderSummary.update({
      id: trimmedSupplierName,
      ...payload,
    });

    if (errors && errors.length > 0) {
      throw new Error(errors[0]?.message ?? "同步供應商入庫摘要失敗");
    }

    return;
  }

  const { errors } = await client.models.SupplierOrderSummary.create({
    id: trimmedSupplierName,
    ...payload,
    gsiPartition: "SupplierOrderSummary",
  });

  if (errors && errors.length > 0) {
    throw new Error(errors[0]?.message ?? "建立供應商入庫摘要失敗");
  }
}

export async function syncSupplierOrderSummariesByNames(
  supplierNames: Array<string | null | undefined>,
): Promise<void> {
  const uniqueNames = Array.from(
    new Set(
      supplierNames
        .map((supplierName) => String(supplierName ?? "").trim())
        .filter(Boolean),
    ),
  );

  await Promise.all(
    uniqueNames.map((supplierName) =>
      syncSupplierOrderSummaryBySupplierName(supplierName),
    ),
  );
}
