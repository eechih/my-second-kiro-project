import { FormField } from "@/components/FormField";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import {
  getTranslationSupplierLabel,
  TRANSLATION_SUPPLIERS,
  type TranslationSupplier,
} from "@shared/logic/translation-parser";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";

export interface SupplierFormValues {
  name: string;
  phone: string;
  email: string;
  address: string;
  translationParser: TranslationSupplier | "";
}

export interface SupplierFormProps {
  isSubmitting: boolean;
  initialValues?: SupplierFormValues;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
}

const DEFAULT_SUPPLIER_VALUES: SupplierFormValues = {
  name: "",
  phone: "",
  email: "",
  address: "",
  translationParser: "",
};

export function SupplierForm({
  isSubmitting,
  initialValues = DEFAULT_SUPPLIER_VALUES,
  submitLabel = "建立",
  onCancel,
  onSubmit,
}: SupplierFormProps): React.ReactElement {
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  return (
    <Paper sx={{ p: 3 }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <Stack spacing={3}>
          <form.Field
            name="name"
            validators={{
              onBlur: ({ value }) =>
                !value.trim() ? "供應商名稱為必填" : undefined,
            }}
          >
            {(field) => (
              <FormField field={field} label="供應商名稱" required />
            )}
          </form.Field>

          <form.Field name="phone">
            {(field) => <FormField field={field} label="電話" />}
          </form.Field>

          <form.Field name="email">
            {(field) => <FormField field={field} label="Email" type="email" />}
          </form.Field>

          <form.Field name="address">
            {(field) => (
              <FormField field={field} label="地址" multiline rows={2} />
            )}
          </form.Field>

          <form.Field name="translationParser">
            {(field) => (
              <FormControl fullWidth>
                <InputLabel id="supplier-translation-parser-label">
                  貼文解析器
                </InputLabel>
                <Select
                  labelId="supplier-translation-parser-label"
                  label="貼文解析器"
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as TranslationSupplier | "",
                    )
                  }
                  onBlur={field.handleBlur}
                >
                  <MenuItem value="">未指定</MenuItem>
                  {TRANSLATION_SUPPLIERS.map((parser) => (
                    <MenuItem key={parser} value={parser}>
                      {getTranslationSupplierLabel(parser)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </form.Field>

          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={onCancel}>
              取消
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? <CircularProgress size={16} /> : undefined
              }
            >
              {submitLabel}
            </Button>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
}
