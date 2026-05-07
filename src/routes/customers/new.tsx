import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useCreateCustomer } from "@/hooks/useCustomers";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { validateCustomer } from "@shared/logic/validation";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useState } from "react";

export const Route = createFileRoute("/customers/new")({
  beforeLoad: requireAuth,
  component: CustomerNewPage,
});

function CustomerNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateCustomer();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      const validation = validateCustomer(
        value as unknown as Record<string, unknown>,
      );
      if (!validation.valid) {
        setSubmitError(validation.error ?? "驗證失敗");
        return;
      }

      try {
        await createMutation.mutateAsync({
          name: value.name,
          contactPerson: value.contactPerson,
          phone: value.phone,
          email: value.email || undefined,
          address: value.address || undefined,
        });
        void navigate({ to: "/customers" });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "建立客戶失敗");
      }
    },
  });

  return (
    <Box sx={{ maxWidth: 600 }}>
      <PageHeader section="客戶" current="新增" title="新增客戶" />

      {submitError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setSubmitError(null)}
        >
          {submitError}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
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

            <form.Field
              name="contactPerson"
              validators={{
                onBlur: ({ value }) =>
                  !value.trim() ? "聯絡人為必填" : undefined,
              }}
            >
              {(field) => <FormField field={field} label="聯絡人" required />}
            </form.Field>

            <form.Field
              name="phone"
              validators={{
                onBlur: ({ value }) =>
                  !value.trim() ? "電話為必填" : undefined,
              }}
            >
              {(field) => <FormField field={field} label="電話" required />}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <FormField field={field} label="Email" type="email" />
              )}
            </form.Field>

            <form.Field name="address">
              {(field) => (
                <FormField field={field} label="地址" multiline rows={2} />
              )}
            </form.Field>

            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                onClick={() => void navigate({ to: "/customers" })}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createMutation.isPending}
                startIcon={
                  createMutation.isPending ? (
                    <CircularProgress size={16} />
                  ) : undefined
                }
              >
                建立
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
