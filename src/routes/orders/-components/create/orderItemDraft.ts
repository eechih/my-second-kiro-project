import {
  buildOptionVariantLabel,
  resolveEffectivePrice,
  resolveEffectivePriceFromOptions,
  validateOptionValuesRequired,
  validateVariantRequired,
} from "@shared/logic/product-variant";
import type { Product, ProductOptionValue, ProductVariant } from "@shared/models";
import type { CreateOrderItemInput } from "./formTypes";

export interface OrderItemDraft {
  product: Product | null;
  variant: ProductVariant | null;
  selectedOptionValues: ProductOptionValue[];
  quantity: number;
  unitPrice: number;
}

export function createDefaultOrderItemDraft(): OrderItemDraft {
  return {
    product: null,
    variant: null,
    selectedOptionValues: [],
    quantity: 1,
    unitPrice: 0,
  };
}

export function getOrderItemDraftError(draft: OrderItemDraft): string | null {
  if (!draft.product) {
    return "請選取商品";
  }

  const variantValidation = validateVariantRequired(
    draft.product,
    draft.variant?.label ?? null,
  );
  const optionValidation = validateOptionValuesRequired(
    draft.product,
    draft.selectedOptionValues,
  );

  if (!optionValidation.valid) {
    return optionValidation.error ?? "請選取所有規格選項";
  }

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

export function buildOrderItemFormData(
  draft: OrderItemDraft,
): CreateOrderItemInput {
  if (!draft.product) {
    throw new Error("請選取商品");
  }

  return {
    productId: draft.product.id,
    productName: draft.product.name,
    productSku: draft.product.sku,
    variantLabel:
      buildOptionVariantLabel(draft.selectedOptionValues) ??
      draft.variant?.label ??
      null,
    quantity: draft.quantity,
    unitPrice: draft.unitPrice,
  };
}

export function resolveDraftUnitPrice(
  product: Product,
  variant: ProductVariant | null,
  selectedOptionValues: ProductOptionValue[] = [],
): number {
  if (product.options.length > 0) {
    return resolveEffectivePriceFromOptions(product, selectedOptionValues);
  }

  if (!variant) {
    return product.price;
  }

  return resolveEffectivePrice(variant, product);
}
