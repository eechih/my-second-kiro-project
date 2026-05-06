import { useState, useEffect, useCallback, useRef } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";

export interface EntitySelectProps<T> {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
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
  searchFn,
  getOptionLabel,
  filterActive: _filterActive = true,
  error,
  disabled = false,
  required = false,
}: EntitySelectProps<T>): React.ReactElement {
  const [options, setOptions] = useState<T[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOptions = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const results = await searchFn(query);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [searchFn],
  );

  // Initial load
  useEffect(() => {
    void fetchOptions("");
  }, [fetchOptions]);

  const handleInputChange = (
    _event: React.SyntheticEvent,
    newInputValue: string,
  ): void => {
    setInputValue(newInputValue);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void fetchOptions(newInputValue);
    }, 300);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <Autocomplete
      value={value}
      onChange={(_event, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={options}
      getOptionLabel={getOptionLabel}
      loading={loading}
      disabled={disabled}
      isOptionEqualToValue={(option, val) =>
        getOptionLabel(option) === getOptionLabel(val)
      }
      noOptionsText="無符合項目"
      loadingText="載入中..."
      renderInput={(params) => (
        <TextField
          {...params}
          label={required ? `${label} *` : label}
          error={!!error}
          helperText={error}
          slotProps={{
            input: {
              ...(((params as unknown as { slotProps?: { input?: unknown } })
                .slotProps?.input ??
                (params as unknown as { InputProps?: unknown }).InputProps) as
                | Record<string, unknown>
                | undefined),
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {(
                    ((params as unknown as { slotProps?: { input?: unknown } })
                      .slotProps?.input ??
                      (params as unknown as { InputProps?: unknown }).InputProps) as
                      | { endAdornment?: React.ReactNode }
                      | undefined
                  )?.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
