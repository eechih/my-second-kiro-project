import { PageHeader } from "@/components/PageHeader";
import { useSupplier, useUpdateSupplier } from "@/hooks/useSuppliers";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { validateSupplier } from "@shared/logic/validation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  SupplierForm,
  type SupplierFormValues,
} from "./-components/SupplierForm";
import { SupplierReceivingTable } from "./-components/SupplierReceivingTable";

export const Route = createFileRoute("/suppliers/$supplierId")({
  beforeLoad: requireAuth,
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

  const initialValues = useMemo<SupplierFormValues | undefined>(() => {
    if (!supplier) return undefined;
    return {
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      translationParser: supplier.translationParser ?? "",
    };
  }, [supplier]);

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
      await updateMutation.mutateAsync({
        id: supplierId,
        name: values.name,
        phone: values.phone,
        email: values.email,
        address: values.address,
        translationParser: values.translationParser || null,
      });
      void navigate({ to: "/suppliers" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "更新供應商失敗");
    }
  };

  if (isLoadingSupplier) {
    return <SupplierEditSkeleton />;
  }

  if (loadError) {
    return (
      <Box sx={{ maxWidth: 600 }}>
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
      <Box sx={{ maxWidth: 600 }}>
        <Alert severity="warning">找不到該供應商</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader section="供應商" current="編輯" title="編輯供應商" />

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
          <SupplierForm
            initialValues={initialValues}
            isSubmitting={updateMutation.isPending}
            submitLabel="儲存"
            onCancel={() => void navigate({ to: "/suppliers" })}
            onSubmit={handleSubmit}
          />
        </Box>

        <SupplierReceivingTable supplierName={supplier.name} />
      </Stack>
    </Box>
  );
}

function SupplierEditSkeleton(): React.ReactElement {
  return (
    <Box sx={{ maxWidth: 600 }}>
      <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} variant="rectangular" height={56} />
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
