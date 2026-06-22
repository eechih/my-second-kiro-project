import { ListToolbar, type ListToolbarOption } from "@/components/ListToolbar";
import type { ProductPurchaseStatusFilter } from "@/hooks/useProductPurchases";

export type { ProductPurchaseStatusFilter } from "@/hooks/useProductPurchases";

export const PRODUCT_PURCHASE_STATUS_OPTIONS = [
  { value: "pending", label: "待處理" },
  { value: "ordered", label: "已採購" },
] satisfies readonly ListToolbarOption<ProductPurchaseStatusFilter>[];

export interface ProductPurchasesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: ProductPurchaseStatusFilter;
  onStatusFilterChange: (value: ProductPurchaseStatusFilter) => void;
}

export function ProductPurchasesToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
}: ProductPurchasesToolbarProps): React.ReactElement {
  return (
    <ListToolbar
      search={search}
      onSearchChange={onSearchChange}
      totalCount={totalCount}
      statusSelect={{
        value: statusFilter,
        onChange: onStatusFilterChange,
        options: PRODUCT_PURCHASE_STATUS_OPTIONS,
        ariaLabel: "篩選單品採購狀態",
      }}
    />
  );
}
