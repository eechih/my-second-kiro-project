import { PageHeader } from "@/components/PageHeader";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { validateCustomer } from "@shared/logic/validation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  CustomerForm,
  type CustomerFormValues,
} from "./-components/CustomerForm";

export const Route = createFileRoute("/customers/new")({
  beforeLoad: requireAuth,
  component: CustomerNewPage,
});

function CustomerNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateCustomer();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      await createMutation.mutateAsync({
        name: values.name,
        contactPerson: values.contactPerson,
        phone: values.phone,
        email: values.email || undefined,
        address: values.address || undefined,
      });
      void navigate({ to: "/customers" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "建立客戶失敗");
    }
  };

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

      <CustomerForm
        isSubmitting={createMutation.isPending}
        onCancel={() => void navigate({ to: "/customers" })}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
