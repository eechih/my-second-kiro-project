import type { SelectedOptionSnapshot } from "@shared/models";

export interface OrderItemFormData {
  /** 臨時 ID（用於 React key） */
  tempId: string;
  productId: string;
  productName: string;
  productImageUrl?: string | null;
  productSku: string;
  variantLabel: string | null;
  selectedOptionsSnapshot?: SelectedOptionSnapshot[];
  quantity: number;
  unitPrice: number;
  unitCost?: number | null;
}

export type CreateOrderItemInput = Omit<OrderItemFormData, "tempId">;

export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
