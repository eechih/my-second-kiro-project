import {
  ListToolbar,
  type ListToolbarOption,
} from "@/components/ListToolbar";
import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";

export type ProductStatusFilter = "all" | "active" | "inactive";

const STATUS_OPTIONS = [
  { value: "all", label: "全部狀態" },
  { value: "active", label: "啟用中" },
  { value: "inactive", label: "已停用" },
] as const satisfies readonly ListToolbarOption<ProductStatusFilter>[];

export interface ProductToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: ProductStatusFilter;
  onStatusFilterChange: (value: ProductStatusFilter) => void;
  onAddClick: () => void;
}

export function ProductToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  onAddClick,
}: ProductToolbarProps): React.ReactElement {
  return (
    <ListToolbar
      search={search}
      onSearchChange={onSearchChange}
      totalCount={totalCount}
      statusSelect={{
        value: statusFilter,
        onChange: onStatusFilterChange,
        options: STATUS_OPTIONS,
        ariaLabel: "狀態篩選",
      }}
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAddClick}>
          新增商品
        </Button>
      }
    />
  );
}
