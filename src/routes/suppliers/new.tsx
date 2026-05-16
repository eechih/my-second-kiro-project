import { PageHeader } from "@/components/PageHeader";
import { useCreateSupplier } from "@/hooks/useSuppliers";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import { validateSupplier } from "@shared/logic/validation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  SupplierForm,
  type SupplierFormValues,
} from "./-components/SupplierForm";

export const Route = createFileRoute("/suppliers/new")({
  beforeLoad: requireAuth,
  component: SupplierNewPage,
});

function SupplierNewPage() {
  const navigate = useNavigate();
  const createMutation = useCreateSupplier();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (values: SupplierFormValues): Promise<void> => {
    setSubmitError(null);

    const validation = validateSupplier(
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
        translationParser: values.translationParser || null,
      });
      void navigate({ to: "/suppliers" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "建立供應商失敗");
    }
  };

  return (
    <Box sx={{ maxWidth: 600 }}>
      <PageHeader section="供應商" current="新增" title="新增供應商" />

      {submitError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setSubmitError(null)}
        >
          {submitError}
        </Alert>
      )}

      <SupplierForm
        isSubmitting={createMutation.isPending}
        onCancel={() => void navigate({ to: "/suppliers" })}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
