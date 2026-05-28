import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import type { ProductOption, ProductOptionValue } from "@shared/models/product";

export interface ProductOptionValueSelectsProps {
  options: ProductOption[];
  value: Record<string, ProductOptionValue | null>;
  onChange: (optionId: string, value: ProductOptionValue | null) => void;
  error?: string;
  disabled?: boolean;
}

export function ProductOptionValueSelects({
  options,
  value,
  onChange,
  error,
  disabled = false,
}: ProductOptionValueSelectsProps): React.ReactElement {
  return (
    <Stack spacing={2}>
      {options.map((option) => {
        const selectedValue = value[option.id] ?? null;

        return (
          <FormControl
            key={option.id}
            fullWidth
            disabled={disabled}
            error={!!error && !selectedValue}
          >
            <InputLabel id={`product-option-${option.id}`}>{option.name}</InputLabel>
            <Select
              labelId={`product-option-${option.id}`}
              label={option.name}
              value={selectedValue?.id ?? ""}
              onChange={(event) => {
                const nextValue =
                  option.values.find((item) => item.id === event.target.value) ??
                  null;
                onChange(option.id, nextValue);
              }}
            >
              <MenuItem value="">
                <em>請選擇</em>
              </MenuItem>
              {option.values.map((optionValue) => (
                <MenuItem key={optionValue.id} value={optionValue.id}>
                  {optionValue.name}
                </MenuItem>
              ))}
            </Select>
            {!!error && !selectedValue && (
              <FormHelperText>{error}</FormHelperText>
            )}
          </FormControl>
        );
      })}
    </Stack>
  );
}
