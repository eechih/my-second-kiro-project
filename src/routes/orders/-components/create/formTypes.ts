export interface OrderItemFormData {
  /** 臨時 ID（用於 React key） */
  tempId: string;
  productId: string;
  productName: string;
  productSku: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
}

export type CreateOrderItemInput = Omit<OrderItemFormData, "tempId">;

export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
