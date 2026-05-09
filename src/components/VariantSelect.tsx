import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import type { ProductVariant } from "@shared/models/product";

export interface VariantSelectProps {
  /** 商品 ID */
  productId: string;
  /** 該商品的所有規格組合 */
  variants: ProductVariant[];
  /** 目前選取的規格組合 */
  value: ProductVariant | null;
  /** 選取變更回呼 */
  onChange: (variant: ProductVariant | null) => void;
  /** 驗證錯誤訊息（如「請選取規格組合」） */
  error?: string;
  /** 是否停用 */
  disabled?: boolean;
}

/**
 * 規格組合選取元件。
 *
 * 使用 MUI Autocomplete，選項標籤顯示規格組合名稱（如「黑 L」）及庫存數量。
 * 用於訂單明細新增時，當選取的商品具有規格組合，顯示下拉選單供使用者選取特定規格組合。
 *
 * 需求：3.15, 4.12, 4.13
 */
export function VariantSelect({
  productId: _productId,
  variants,
  value,
  onChange,
  error,
  disabled = false,
}: VariantSelectProps): React.ReactElement {
  return (
    <Autocomplete
      value={value}
      onChange={(_event, newValue) => onChange(newValue)}
      options={variants}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      disabled={disabled}
      noOptionsText="無可選規格組合"
      renderInput={(params) => (
        <TextField
          {...params}
          label="規格組合 *"
          error={!!error}
          helperText={error}
          placeholder="請選取規格組合"
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          {option.label}
        </li>
      )}
    />
  );
}
