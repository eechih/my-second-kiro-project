import { FormField } from "@/components/FormField";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";

export interface CustomerFormValues {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}

export interface CustomerFormProps {
  isSubmitting: boolean;
  initialValues?: CustomerFormValues;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
}

const DEFAULT_CUSTOMER_VALUES: CustomerFormValues = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
};

export function CustomerForm({
  isSubmitting,
  initialValues = DEFAULT_CUSTOMER_VALUES,
  submitLabel = "建立",
  onCancel,
  onSubmit,
}: CustomerFormProps): React.ReactElement {
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
                !value.trim() ? "客戶名稱為必填" : undefined,
            }}
          >
            {(field) => <FormField field={field} label="客戶名稱" required />}
          </form.Field>

          <form.Field name="contactPerson">
            {(field) => <FormField field={field} label="聯絡人" />}
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
