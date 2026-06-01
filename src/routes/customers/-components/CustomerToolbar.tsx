import {
  ListToolbar,
  type ListToolbarOption,
} from "@/components/ListToolbar";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import type { SortField } from "@/lib/table-utils";

/**
 * 狀態篩選型別
 */
export type StatusFilter = "all" | "active" | "inactive";

/**
 * CustomerToolbar 元件 Props
 * 需求：1.1, 1.2, 1.3, 1.4, 1.6
 */
export interface CustomerToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortField: SortField;
  onSortFieldChange: (value: SortField) => void;
  onAddClick: () => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "全部狀態" },
  { value: "active", label: "啟用中" },
  { value: "inactive", label: "已停用" },
] as const satisfies readonly ListToolbarOption<StatusFilter>[];

const SORT_OPTIONS = [
  { value: "name", label: "客戶名稱" },
  { value: "phone", label: "電話" },
  { value: "createdAt", label: "建立日期" },
] as const satisfies readonly ListToolbarOption<SortField>[];

/**
 * 客戶列表工具列元件
 *
 * 水平排列：搜尋輸入框、狀態篩選、排序下拉選單、新增客戶按鈕
 * 需求：1.1, 1.2, 1.3, 1.4, 1.6
 */
export function CustomerToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
  sortField,
  onSortFieldChange,
  onAddClick,
}: CustomerToolbarProps): React.ReactElement {
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
          {/* 新增客戶按鈕 - 需求 1.6 */}
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onAddClick}
          >
            新增客戶
          </Button>
        </>
      }
    />
  );
}
