import { PageHeader } from "@/components/PageHeader";
import { useCustomer, useUpdateCustomer } from "@/hooks/useCustomers";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { validateCustomer } from "@shared/logic/validation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CustomerForm,
  type CustomerFormValues,
} from "./-components/CustomerForm";

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

  const initialValues = useMemo<CustomerFormValues | undefined>(() => {
    if (!customer) return undefined;
    return {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    };
  }, [customer]);

  const handleSubmit = async (values: CustomerFormValues): Promise<void> => {
    setSubmitError(null);

    const validation = validateCustomer(
      values as unknown as Record<string, unknown>,
    );
    if (!validation.valid) {
      setSubmitError(validation.error ?? "驗證失敗");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: customerId,
        name: values.name,
        phone: values.phone,
        email: values.email,
        address: values.address,
      });
      void navigate({ to: "/customers" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "更新客戶失敗");
    }
  };

  if (isLoadingCustomer) {
    return <CustomerEditSkeleton />;
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
    <Box>
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

      <Stack spacing={3}>
        <Box sx={{ maxWidth: 600 }}>
          <CustomerForm
            initialValues={initialValues}
            isSubmitting={updateMutation.isPending}
            submitLabel="儲存"
            onCancel={() => void navigate({ to: "/customers" })}
            onSubmit={handleSubmit}
          />
        </Box>
      </Stack>
    </Box>
  );
}

function CustomerEditSkeleton(): React.ReactElement {
  return (
    <Box sx={{ maxWidth: 600 }}>
      <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} variant="rectangular" height={56} />
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
