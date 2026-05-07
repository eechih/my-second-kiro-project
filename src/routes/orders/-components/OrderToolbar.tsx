import {
  ListToolbar,
  type ListToolbarOption,
} from "@/components/ListToolbar";
import AddIcon from "@mui/icons-material/Add";
import MergeIcon from "@mui/icons-material/CallMerge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { OrderStatusFilter } from "@/hooks/useOrders";

const STATUS_OPTIONS = [
  { value: "all", label: "全部狀態" },
  { value: "pending", label: "待處理" },
  { value: "confirmed", label: "已確認" },
  { value: "shipping", label: "出貨中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
] as const satisfies readonly ListToolbarOption<OrderStatusFilter>[];

export interface OrderToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: OrderStatusFilter;
  onStatusFilterChange: (value: OrderStatusFilter) => void;
  onMergeClick: () => void;
  onAddClick: () => void;
}

export function OrderToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  onMergeClick,
  onAddClick,
}: OrderToolbarProps): React.ReactElement {
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
        <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
          <Button
            variant="outlined"
            startIcon={<MergeIcon />}
            onClick={onMergeClick}
          >
            合併訂單
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddClick}
          >
            新增訂單
          </Button>
        </Box>
      }
    />
  );
}
