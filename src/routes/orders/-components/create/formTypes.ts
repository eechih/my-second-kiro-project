export interface LineItemFormData {
  /** 臨時 ID（用於 React key） */
  tempId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
}

export type CreateLineItemInput = Omit<LineItemFormData, "tempId">;

export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
