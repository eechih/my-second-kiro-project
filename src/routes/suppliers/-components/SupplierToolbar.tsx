import {
  ListToolbar,
  type ListToolbarOption,
} from "@/components/ListToolbar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import type {
  StatusFilter,
  SupplierSortField,
} from "@/hooks/useSuppliers";

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

const STATUS_OPTIONS = [
  { value: "all", label: "全部狀態" },
  { value: "active", label: "啟用中" },
  { value: "inactive", label: "已停用" },
] as const satisfies readonly ListToolbarOption<StatusFilter>[];

const SORT_OPTIONS = [
  { value: "name", label: "供應商名稱" },
  { value: "contactPerson", label: "聯絡人" },
  { value: "phone", label: "電話" },
  { value: "createdAt", label: "建立日期" },
] as const satisfies readonly ListToolbarOption<SupplierSortField>[];

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
        minWidth: 120,
        displayEmpty: true,
      }}
      sortSelect={{
        value: sortField,
        onChange: onSortFieldChange,
        options: SORT_OPTIONS,
        ariaLabel: "排序欄位",
        minWidth: 120,
      }}
      actions={
        <>
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
            {isExporting ? (
              <CircularProgress size={24} />
            ) : (
              <FileDownloadIcon />
            )}
          </IconButton>
        </>
      }
    />
  );
}
