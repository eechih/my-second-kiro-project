import {
  ListToolbar,
  type ListToolbarOption,
} from "@/components/ListToolbar";
import AddIcon from "@mui/icons-material/Add";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import type { ProductStatusFilter } from "@/hooks/useProducts";

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
  onAddFromPostClick: () => void;
}

export function ProductToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  onAddClick,
  onAddFromPostClick,
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
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AutoFixHighIcon />}
            onClick={onAddFromPostClick}
          >
            從 FB 貼文新增
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddClick}
          >
            新增商品
          </Button>
        </Stack>
      }
    />
  );
}
