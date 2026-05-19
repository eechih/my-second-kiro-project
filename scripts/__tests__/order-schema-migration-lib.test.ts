import { describe, expect, it } from "vitest";
import {
  mapLegacyCounterToSequenceCounter,
  mapLegacyLineItemToOrderItem,
  mapLegacyOrderToCurrentShape,
  normalizeSearchName,
  resolveSortTimestamp,
} from "../order-schema-migration-lib";

describe("order-schema-migration-lib", () => {
  it("resolves sort timestamp from createdAt first", () => {
    expect(
      resolveSortTimestamp({
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      }),
    ).toBe("2026-05-01T00:00:00.000Z");
  });

  it("normalizes product search name", () => {
    expect(normalizeSearchName("  經典 白襯衫  ")).toBe("經典 白襯衫");
  });

  it("maps legacy order fields into new schema fields", () => {
    expect(
      mapLegacyOrderToCurrentShape({
        customerName: "王小明",
        totalAmount: 1200,
        status: "confirmed",
        createdAt: "2026-05-10T00:00:00.000Z",
      }),
    ).toMatchObject({
      customerNameSnapshot: "王小明",
      subtotalAmount: 1200,
      shippingFee: 0,
      discountAmount: 0,
      paymentStatus: "UNPAID",
      fulfillmentStatus: "READY_TO_SHIP",
      gsiPartition: "Order",
      isActive: true,
      createdAtForSort: "2026-05-10T00:00:00.000Z",
    });
  });

  it("maps legacy line item to order item snapshot shape", () => {
    expect(
      mapLegacyLineItemToOrderItem(
        {
          id: "li-1",
          orderId: "order-1",
          productId: "product-1",
          productName: "白襯衫",
          variantLabel: "L",
          quantity: 2,
          unitPrice: 500,
          subtotal: 1000,
          status: "received",
          createdAt: "2026-05-10T00:00:00.000Z",
        },
        "SKU-000001",
      ),
    ).toMatchObject({
      id: "li-1",
      orderId: "order-1",
      productId: "product-1",
      productNameSnapshot: "白襯衫",
      productSkuSnapshot: "SKU-000001",
      variantLabelSnapshot: "L",
      subtotalAmount: 1000,
      status: "received",
      createdAtForSort: "2026-05-10T00:00:00.000Z",
    });
  });

  it("maps legacy counter to sequence counter", () => {
    expect(
      mapLegacyCounterToSequenceCounter({
        id: "ProductSku",
        nextNumber: 42,
      }),
    ).toMatchObject({
      id: "ProductSku",
      name: "ProductSku",
      current: 42,
    });
  });
});
