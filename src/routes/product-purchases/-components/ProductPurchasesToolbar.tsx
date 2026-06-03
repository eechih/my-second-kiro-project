import { ListToolbar, type ListToolbarOption } from "@/components/ListToolbar";
import Button from "@mui/material/Button";
import type { OrderItem } from "@shared/models";

export type ProductPurchaseStatusFilter = "all" | OrderItem["status"];

export const PRODUCT_PURCHASE_STATUS_OPTIONS = [
  { value: "all", label: "全部作業狀態" },
  { value: "pending", label: "待處理" },
  { value: "ordered", label: "已訂貨" },
  { value: "received", label: "已到貨" },
  { value: "shipped", label: "已出貨" },
  { value: "out_of_stock", label: "缺貨" },
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
