import { useState, useEffect, useCallback, useRef } from "react";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

/**
 * 搜尋輸入框元件，含防抖（debounce）功能。
 * 使用者輸入後延遲觸發 onChange，減少不必要的 API 呼叫。
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "搜尋...",
  debounceMs = 300,
}: SearchBarProps): React.ReactElement {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const debouncedOnChange = useCallback(
    (newValue: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = event.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  return (
    <TextField
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      size="small"
      sx={{ minWidth: 250 }}
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
  );
}
