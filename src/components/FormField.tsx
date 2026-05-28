import TextField from "@mui/material/TextField";
import type { SxProps, Theme } from "@mui/material/styles";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { ReactNode } from "react";

/**
 * 從 TanStack Form 的 FieldApi 中提取錯誤訊息。
 * 回傳第一個驗證錯誤的字串表示，若無錯誤則回傳 undefined。
 */
function getFieldError(field: AnyFieldApi): string | undefined {
  const { isTouched, errors } = field.state.meta;
  if (!isTouched || errors.length === 0) {
    return undefined;
  }
  const firstError = errors[0];
  if (typeof firstError === "string") {
    return firstError;
  }
  if (firstError && typeof firstError === "object" && "message" in firstError) {
    return String((firstError as { message: unknown }).message);
  }
  return firstError ? String(firstError) : undefined;
}

export interface FormFieldProps {
  /** TanStack Form 的 FieldApi 實例 */
  field: AnyFieldApi;
  /** 欄位標籤 */
  label: string;
  /** 是否必填（預設 false），必填時標籤自動加上星號 */
  required?: boolean;
  /** 輸入類型（預設 'text'） */
  type?: "text" | "number" | "email" | "password";
  /** 是否多行（預設 false） */
  multiline?: boolean;
  /** 多行時的行數 */
  rows?: number;
  /** 多行時的最少行數，未設定 rows 時會依內容自動展開 */
  minRows?: number;
  /** 是否停用 */
  disabled?: boolean;
  /** 是否全寬（預設 true） */
  fullWidth?: boolean;
  /** 額外樣式 */
  sx?: SxProps<Theme>;
  /**
   * 自訂渲染函式（render prop）。
   * 用於非 TextField 的元件（如 EntitySelect、VariantSelect）。
   * 當提供 children 時，不渲染預設的 TextField，改為渲染 children 的回傳值。
   * children 接收 field 實例及 error 資訊。
   */
  children?: (props: {
    field: AnyFieldApi;
    error: string | undefined;
    hasError: boolean;
  }) => ReactNode;
}

/**
 * TanStack Form + MUI 整合元件。
 *
 * 封裝 TanStack Form 的 field.state 與 MUI TextField 的綁定：
 * - 自動處理 value/onChange 雙向綁定
 * - 自動處理 error 狀態與 helperText 顯示第一個驗證錯誤
 * - 必填欄位自動標記星號（*）
 * - 支援 children render prop 用於自訂渲染（EntitySelect、VariantSelect 等）
 *
 * 所有表單頁面統一使用 FormField 而非直接操作 TanStack Form 的 field API。
 */
export function FormField({
  field,
  label,
  required = false,
  type = "text",
  multiline = false,
  rows,
  minRows,
  disabled = false,
  fullWidth = true,
  sx,
  children,
}: FormFieldProps): React.ReactElement {
  const errorMessage = getFieldError(field);
  const hasError = !!errorMessage;
  const displayLabel = required ? `${label} *` : label;

  // If children render prop is provided, use custom rendering
  if (children) {
    return <>{children({ field, error: errorMessage, hasError })}</>;
  }

  // Default: render MUI TextField bound to TanStack Form field
  return (
    <TextField
      label={displayLabel}
      value={field.state.value ?? ""}
      onChange={(e) => {
        const newValue =
          type === "number" ? Number(e.target.value) : e.target.value;
        field.handleChange(newValue);
      }}
      onBlur={field.handleBlur}
      error={hasError}
      helperText={errorMessage}
      type={type}
      multiline={multiline}
      rows={rows}
      minRows={minRows}
      disabled={disabled}
      fullWidth={fullWidth}
      sx={sx}
    />
  );
}
