import { resolveEffectivePrice, validateVariantRequired } from "@shared/logic/product-variant";
import type { Product, ProductVariant } from "@shared/models";
import type { CreateLineItemInput } from "./formTypes";

export interface LineItemDraft {
  product: Product | null;
  variant: ProductVariant | null;
  quantity: number;
  unitPrice: number;
}

export function createDefaultLineItemDraft(): LineItemDraft {
  return {
    product: null,
    variant: null,
    quantity: 1,
    unitPrice: 0,
  };
}

export function getLineItemDraftError(draft: LineItemDraft): string | null {
  if (!draft.product) {
    return "請選取商品";
  }

  const variantValidation = validateVariantRequired(
    draft.product,
    draft.variant?.label ?? null,
  );
  if (!variantValidation.valid) {
    return variantValidation.error ?? "請選取規格組合";
  }

  if (draft.quantity <= 0) {
    return "數量必須大於 0";
  }

  if (draft.unitPrice < 0) {
    return "單價不得小於 0";
  }

  return null;
}

export function buildLineItemFormData(
  draft: LineItemDraft,
): CreateLineItemInput {
  if (!draft.product) {
    throw new Error("請選取商品");
  }

  return {
    productId: draft.product.id,
    productName: draft.product.name,
    productSku: draft.product.sku,
    variantLabel: draft.variant?.label ?? null,
    quantity: draft.quantity,
    unitPrice: draft.unitPrice,
  };
}

export function resolveDraftUnitPrice(
  product: Product,
  variant: ProductVariant | null,
): number {
  if (!variant) {
    return product.price;
  }

  return resolveEffectivePrice(variant, product);
}
