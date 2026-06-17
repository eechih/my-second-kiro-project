import { ListToolbar, type ListToolbarOption } from "@/components/ListToolbar";
import type { ProductPurchaseStatusFilter } from "@/hooks/useProductPurchases";
import Button from "@mui/material/Button";

export type { ProductPurchaseStatusFilter } from "@/hooks/useProductPurchases";

export const PRODUCT_PURCHASE_STATUS_OPTIONS = [
  { value: "pending", label: "未訂貨" },
  { value: "ordered", label: "已訂貨" },
  { value: "all", label: "全部" },
] as const satisfies readonly ListToolbarOption<ProductPurchaseStatusFilter>[];

export interface ProductPurchasesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: ProductPurchaseStatusFilter;
  onStatusFilterChange: (value: ProductPurchaseStatusFilter) => void;
  onBackClick: () => void;
}

export function ProductPurchasesToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  onBackClick,
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
      actions={
        <Button variant="outlined" color="inherit" onClick={onBackClick}>
          返回訂單列表
        </Button>
      }
    />
  );
}
