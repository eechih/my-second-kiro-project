import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useCustomer, useUpdateCustomer } from "@/hooks/useCustomers";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { validateCustomer } from "@shared/logic/validation";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAuth } from "@/lib/route-guards";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/customers/$customerId")({
  beforeLoad: requireAuth,
  component: CustomerEditPage,
});

function CustomerEditPage() {
  const navigate = useNavigate();
  const { customerId } = Route.useParams();
  const {
    data: customer,
    isLoading: isLoadingCustomer,
    error: loadError,
  } = useCustomer(customerId);
  const updateMutation = useUpdateCustomer();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: customer?.name ?? "",
      contactPerson: customer?.contactPerson ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
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
        await updateMutation.mutateAsync({
          id: customerId,
          name: value.name,
          contactPerson: value.contactPerson,
          phone: value.phone,
          email: value.email,
          address: value.address,
        });
        void navigate({ to: "/customers" });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "更新客戶失敗");
      }
    },
  });

  // 當客戶資料載入完成後，重置表單值
  useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name,
        contactPerson: customer.contactPerson,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  if (isLoadingCustomer) {
    return (
      <Box sx={{ maxWidth: 600 }}>
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
      <Box sx={{ maxWidth: 600 }}>
        <Alert severity="error">
          {loadError instanceof Error ? loadError.message : "載入客戶資料失敗"}
        </Alert>
      </Box>
    );
  }

  if (!customer) {
    return (
      <Box sx={{ maxWidth: 600 }}>
        <Alert severity="warning">找不到該客戶</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600 }}>
      <PageHeader section="客戶" current="編輯" title="編輯客戶" />

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
