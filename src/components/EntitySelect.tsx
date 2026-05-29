import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";

export interface EntitySelectProps<T> {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  queryKey: readonly unknown[];
  listFn?: () => Promise<T[]>;
  searchFn: (query: string) => Promise<T[]>;
  getOptionLabel: (option: T) => string;
  filterActive?: boolean;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * 實體選取元件（Autocomplete），用於客戶/供應商/商品選取。
 * 預設僅顯示啟用中（isActive=true）的實體，支援 filterActive prop 控制是否過濾停用實體。
 * 搜尋時含防抖，避免過多 API 呼叫。
 */
export function EntitySelect<T>({
  label,
  value,
  onChange,
  queryKey,
  listFn,
  searchFn,
  getOptionLabel,
  filterActive: _filterActive = true,
  error,
  disabled = false,
  required = false,
}: EntitySelectProps<T>): React.ReactElement {
  const [inputValue, setInputValue] = useState("");
  const debouncedInputValue = useDebouncedValue(inputValue, 300);
  const searchQuery = debouncedInputValue.trim();
  const hasSearchQuery = searchQuery.length > 0;

  const searchResult = useQuery({
    queryKey: hasSearchQuery
      ? [...queryKey, "search", searchQuery]
      : [...queryKey, "list"],
    queryFn: () =>
      hasSearchQuery ? searchFn(searchQuery) : (listFn?.() ?? searchFn("")),
    enabled: !disabled,
    staleTime: 60_000,
  });

  const handleInputChange = (
    _event: React.SyntheticEvent,
    newInputValue: string,
  ): void => {
    setInputValue(newInputValue);
  };

  const searchError =
    searchResult.error instanceof Error
      ? searchResult.error.message
      : "查詢失敗";
  const helperText = error ?? (searchResult.isError ? searchError : undefined);
  const loading = searchResult.isFetching;

  return (
    <Autocomplete
      value={value}
      onChange={(_event, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={searchResult.data ?? []}
      getOptionLabel={getOptionLabel}
      loading={loading}
      disabled={disabled}
      isOptionEqualToValue={(option, val) =>
        getOptionLabel(option) === getOptionLabel(val)
      }
      noOptionsText="無符合項目"
      loadingText="載入中..."
      renderInput={(params) => {
        const { slotProps: paramSlotProps, ...restParams } = params;
        return (
          <TextField
            {...restParams}
            label={required ? `${label} *` : label}
            error={!!helperText}
            helperText={helperText}
            slotProps={{
              ...paramSlotProps,
              input: {
                ...paramSlotProps?.input,
                endAdornment: (
                  <>
                    {loading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {paramSlotProps?.input?.endAdornment}
                  </>
                ),
              },
            }}
          />
        );
      }}
    />
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}
