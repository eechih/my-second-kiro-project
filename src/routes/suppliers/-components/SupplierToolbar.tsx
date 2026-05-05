import { useState, useEffect, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import type { SelectChangeEvent } from "@mui/material/Select";
import type {
  StatusFilter,
  SupplierSortField,
} from "@/hooks/useSupplierListCursor";

/**
 * SupplierToolbar 元件 Props
 * 需求：1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8
 */
export interface SupplierToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortField: SupplierSortField;
  onSortFieldChange: (value: SupplierSortField) => void;
  onAddClick: () => void;
  onExportClick: () => void;
  isExporting: boolean;
}

const DEBOUNCE_MS = 300;

/**
 * 供應商列表工具列元件
 *
 * 水平排列：搜尋輸入框、狀態篩選、排序下拉選單、新增供應商按鈕、CSV 匯出按鈕
 * 需求：1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8
 */
export function SupplierToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  sortField,
  onSortFieldChange,
  onAddClick,
  onExportClick,
  isExporting,
}: SupplierToolbarProps): React.ReactElement {
  const [localSearch, setLocalSearch] = useState(search);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const debouncedOnChange = useCallback(
    (newValue: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        onSearchChange(newValue);
      }, DEBOUNCE_MS);
    },
    [onSearchChange],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const newValue = event.target.value;
    setLocalSearch(newValue);
    debouncedOnChange(newValue);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent): void => {
    onStatusFilterChange(event.target.value as StatusFilter);
  };

  const handleSortFieldChange = (event: SelectChangeEvent): void => {
    onSortFieldChange(event.target.value as SupplierSortField);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      {/* 搜尋輸入框 - 需求 1.1, 1.2 */}
      <TextField
        value={localSearch}
        onChange={handleSearchChange}
        placeholder={`搜尋 ${totalCount} 筆記錄...`}
        size="small"
        sx={{ minWidth: 220, flex: 1 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* 狀態篩選 - 需求 1.3 */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          displayEmpty
        >
          <MenuItem value="all">全部狀態</MenuItem>
          <MenuItem value="active">啟用中</MenuItem>
          <MenuItem value="inactive">已停用</MenuItem>
        </Select>
      </FormControl>

      {/* 排序下拉選單 - 需求 1.4, 1.5 */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select value={sortField} onChange={handleSortFieldChange}>
          <MenuItem value="name">供應商名稱</MenuItem>
          <MenuItem value="contactPerson">聯絡人</MenuItem>
          <MenuItem value="phone">電話</MenuItem>
          <MenuItem value="createdAt">建立日期</MenuItem>
        </Select>
      </FormControl>

      {/* 新增供應商按鈕 - 需求 1.7 */}
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={onAddClick}
      >
        新增供應商
      </Button>

      {/* CSV 匯出按鈕 - 需求 1.8 */}
      <IconButton
        onClick={onExportClick}
        disabled={isExporting}
        aria-label="匯出 CSV"
      >
        {isExporting ? <CircularProgress size={24} /> : <FileDownloadIcon />}
      </IconButton>
    </Box>
  );
}
