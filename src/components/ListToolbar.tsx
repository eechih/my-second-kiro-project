import type { ReactNode } from "react";
import { SearchBar } from "@/components/SearchBar";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";

export interface ListToolbarOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface ListToolbarSelectConfig<TValue extends string> {
  value: TValue;
  onChange: (value: TValue) => void;
  options: readonly ListToolbarOption<TValue>[];
  ariaLabel: string;
  minWidth?: number;
  displayEmpty?: boolean;
}

export interface ListToolbarProps<
  TStatusFilter extends string = string,
  TSortField extends string = string,
> {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  hideSearch?: boolean;
  statusSelect?: ListToolbarSelectConfig<TStatusFilter>;
  sortSelect?: ListToolbarSelectConfig<TSortField>;
  actions?: ReactNode;
}

/**
 * 列表頁共用工具列：搜尋、篩選、排序與操作按鈕容器。
 */
export function ListToolbar<
  TStatusFilter extends string = string,
  TSortField extends string = string,
>({
  search,
  onSearchChange,
  totalCount,
  hideSearch = false,
  statusSelect,
  sortSelect,
  actions,
}: ListToolbarProps<TStatusFilter, TSortField>): React.ReactElement {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      {!hideSearch && (
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={`搜尋 ${totalCount} 筆記錄...`}
        />
      )}

      {statusSelect && <ToolbarSelect select={statusSelect} />}
      {sortSelect && <ToolbarSelect select={sortSelect} />}
      {actions}
    </Box>
  );
}

function ToolbarSelect<TValue extends string>({
  select,
}: {
  select: ListToolbarSelectConfig<TValue>;
}): React.ReactElement {
  const handleChange = (event: SelectChangeEvent): void => {
    select.onChange(event.target.value as TValue);
  };

  return (
    <FormControl size="small" sx={{ minWidth: select.minWidth ?? 160 }}>
      <Select
        value={select.value}
        onChange={handleChange}
        displayEmpty={select.displayEmpty}
        inputProps={{ "aria-label": select.ariaLabel }}
      >
        {select.options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
