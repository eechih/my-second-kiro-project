import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import { useState } from "react";
import { FormField } from "@/components/FormField";
import { useSupplier, useUpdateSupplier } from "@/hooks/useSuppliers";
import { validateSupplier } from "@shared/logic/validation";

export const Route = createFileRoute("/suppliers/$supplierId")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: SupplierEditPage,
});

function SupplierEditPage() {
  const navigate = useNavigate();
  const { supplierId } = Route.useParams();
  const {
    data: supplier,
    isLoading: isLoadingSupplier,
    error: loadError,
  } = useSupplier(supplierId);
  const updateMutation = useUpdateSupplier();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: supplier?.name ?? "",
      contactPerson: supplier?.contactPerson ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      address: supplier?.address ?? "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      const validation = validateSupplier(
        value as unknown as Record<string, unknown>,
      );
      if (!validation.valid) {
        setSubmitError(validation.error ?? "驗證失敗");
        return;
      }

      try {
        await updateMutation.mutateAsync({
          id: supplierId,
          name: value.name,
          contactPerson: value.contactPerson,
          phone: value.phone,
          email: value.email,
          address: value.address,
        });
        void navigate({ to: "/suppliers" });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "更新供應商失敗");
      }
    },
  });

  if (isLoadingSupplier) {
    return (
      <Box maxWidth={600}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={56} />
            ))}
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box maxWidth={600}>
        <Alert severity="error">
          {loadError instanceof Error
            ? loadError.message
            : "載入供應商資料失敗"}
        </Alert>
      </Box>
    );
  }

  if (!supplier) {
    return (
      <Box maxWidth={600}>
        <Alert severity="warning">找不到該供應商</Alert>
      </Box>
    );
  }

  return (
    <Box maxWidth={600}>
      <Typography variant="h4" gutterBottom>
        編輯供應商
      </Typography>

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
                  !value.trim() ? "供應商名稱為必填" : undefined,
              }}
            >
              {(field) => (
                <FormField field={field} label="供應商名稱" required />
              )}
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
                onClick={() => void navigate({ to: "/suppliers" })}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={updateMutation.isPending}
                startIcon={
                  updateMutation.isPending ? (
                    <CircularProgress size={16} />
                  ) : undefined
                }
              >
                儲存
              </Button>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
