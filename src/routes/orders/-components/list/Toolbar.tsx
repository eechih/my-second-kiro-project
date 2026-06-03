import {
  ListToolbar,
  type ListToolbarOption,
} from "@/components/ListToolbar";
import AddIcon from "@mui/icons-material/Add";
import MergeIcon from "@mui/icons-material/CallMerge";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PrintIcon from "@mui/icons-material/Print";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { OrderStatusFilter } from "@/hooks/useOrders";
import { ORDER_STATUSES, ORDER_STATUS_LABEL } from "@shared/models";

const STATUS_OPTIONS = [
  { value: "all", label: "全部狀態" },
  ...ORDER_STATUSES.map((status) => ({
    value: status,
    label: ORDER_STATUS_LABEL[status],
  })),
] as const satisfies readonly ListToolbarOption<OrderStatusFilter>[];

export interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: OrderStatusFilter;
  onStatusFilterChange: (value: OrderStatusFilter) => void;
  mergeDisabled: boolean;
  onMergeClick: () => void;
  printDisabled: boolean;
  onPrintClick: () => void;
  onProductOpsClick: () => void;
  onAddClick: () => void;
}

export function Toolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  mergeDisabled,
  onMergeClick,
  printDisabled,
  onPrintClick,
  onProductOpsClick,
  onAddClick,
}: ToolbarProps): React.ReactElement {
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
            disabled={mergeDisabled}
            onClick={onMergeClick}
          >
            合併訂單
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            disabled={printDisabled}
            onClick={onPrintClick}
          >
            列印出貨單
          </Button>
          <Button
            variant="outlined"
            startIcon={<Inventory2Icon />}
            onClick={onProductOpsClick}
          >
            單品採購
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
