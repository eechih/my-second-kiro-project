import { SearchBar } from "@/components/SearchBar";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

export type ProductStatusFilter = "all" | "active" | "inactive";

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
            onStatusFilterChange(event.target.value as ProductStatusFilter)
          }
        >
          <MenuItem value="all">全部狀態</MenuItem>
          <MenuItem value="active">啟用中</MenuItem>
          <MenuItem value="inactive">已停用</MenuItem>
        </Select>
      </FormControl>

      <Button variant="contained" startIcon={<AddIcon />} onClick={onAddClick}>
        新增商品
      </Button>
    </Box>
  );
}
