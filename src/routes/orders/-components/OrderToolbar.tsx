import { SearchBar } from "@/components/SearchBar";
import AddIcon from "@mui/icons-material/Add";
import MergeIcon from "@mui/icons-material/CallMerge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

export type OrderStatusFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled";

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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <SearchBar
        value={search}
        onChange={onSearchChange}
        placeholder={`搜尋 ${totalCount} 筆記錄...`}
      />

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <Select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as OrderStatusFilter)
          }
        >
          <MenuItem value="all">全部狀態</MenuItem>
          <MenuItem value="pending">待處理</MenuItem>
          <MenuItem value="confirmed">已確認</MenuItem>
          <MenuItem value="shipping">出貨中</MenuItem>
          <MenuItem value="completed">已完成</MenuItem>
          <MenuItem value="cancelled">已取消</MenuItem>
        </Select>
      </FormControl>

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
    </Box>
  );
}
