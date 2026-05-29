import {
  buildOptionVariantLabel,
  resolveEffectiveCostFromOptions,
  resolveEffectivePriceFromOptions,
  validateOptionValuesRequired,
} from "@shared/logic/product-variant";
import type {
  OrderItemSelectedOptionSnapshot,
  Product,
  ProductOptionValue,
} from "@shared/models";
import type { CreateOrderItemInput } from "./formTypes";

export interface OrderItemDraft {
  product: Product | null;
  selectedOptionValues: ProductOptionValue[];
  legacyVariantLabel: string | null;
  quantity: number;
  unitPrice: number;
}

export function createDefaultOrderItemDraft(): OrderItemDraft {
  return {
    product: null,
    selectedOptionValues: [],
    legacyVariantLabel: null,
    quantity: 1,
    unitPrice: 0,
  };
}

export function getOrderItemDraftError(draft: OrderItemDraft): string | null {
  if (!draft.product) {
    return "請選取商品";
  }

  const optionValidation = validateOptionValuesRequired(
    draft.product,
    draft.selectedOptionValues,
  );

  if (!optionValidation.valid) {
    return optionValidation.error ?? "請選取所有規格選項";
  }

  if (draft.quantity <= 0) {
    return "數量必須大於 0";
  }

  if (draft.unitPrice < 0) {
    return "單價不得小於 0";
  }

  return null;
}

function buildSelectedOptionsSnapshot(
  product: Product,
  selectedValues: ProductOptionValue[],
): OrderItemSelectedOptionSnapshot[] {
  if (selectedValues.length === 0) {
    return [];
  }

  return product.options.flatMap((option) => {
    const selectedValue =
      selectedValues.find((value) =>
        option.values.some((candidate) => candidate.id === value.id),
      ) ?? null;

    if (!selectedValue) {
      return [];
    }

    return [
      {
        optionName: option.name,
        valueName: selectedValue.name,
        priceOffset: selectedValue.priceOffset ?? 0,
        costOffset: selectedValue.costOffset ?? 0,
      },
    ];
  });
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
    productImageUrl: draft.product.imageUrls[0] ?? null,
    productSku: draft.product.sku,
    variantLabel:
      buildOptionVariantLabel(draft.selectedOptionValues) ??
      draft.legacyVariantLabel ??
      null,
    selectedOptionsSnapshot: buildSelectedOptionsSnapshot(
      draft.product,
      draft.selectedOptionValues,
    ),
    quantity: draft.quantity,
    unitPrice: draft.unitPrice,
    unitCost:
      draft.product.options.length > 0
        ? resolveEffectiveCostFromOptions(
            draft.product,
            draft.selectedOptionValues,
          )
        : draft.product.cost,
  };
}

export function resolveDraftUnitPrice(
  product: Product,
  selectedOptionValues: ProductOptionValue[] = [],
): number {
  if (product.options.length > 0) {
    return resolveEffectivePriceFromOptions(product, selectedOptionValues);
  }

  return product.price;
}
