import { ListToolbar, type ListToolbarOption } from "@/components/ListToolbar";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import type { ProductPurchaseStatusFilter } from "@/hooks/useProductPurchases";

export type { ProductPurchaseStatusFilter } from "@/hooks/useProductPurchases";

export const PRODUCT_PURCHASE_STATUS_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待處理" },
  { value: "ordered", label: "已採購" },
] satisfies readonly ListToolbarOption<ProductPurchaseStatusFilter>[];

export interface ProductPurchaseSupplierOption {
  value: string;
  label: string;
}

export interface ProductPurchasesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: ProductPurchaseStatusFilter;
  onStatusFilterChange: (value: ProductPurchaseStatusFilter) => void;
  supplierFilter: string;
  onSupplierFilterChange: (value: string) => void;
  supplierOptions: readonly ProductPurchaseSupplierOption[];
}

export function ProductPurchasesToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  supplierFilter,
  onSupplierFilterChange,
  supplierOptions,
}: ProductPurchasesToolbarProps): React.ReactElement {
  const handleSupplierChange = (event: SelectChangeEvent): void => {
    onSupplierFilterChange(event.target.value);
  };

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
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select
            value={supplierFilter}
            onChange={handleSupplierChange}
            inputProps={{ "aria-label": "篩選供應商" }}
          >
            {supplierOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      }
    />
  );
}
