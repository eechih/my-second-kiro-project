import { PageHeader } from "@/components/PageHeader";
import { useCustomer } from "@/hooks/useCustomers";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { createFileRoute } from "@tanstack/react-router";
import { CustomerMergePanel } from "../customers/-components/CustomerMergePanel";
import {
  CustomerShipmentTable,
  type ShipmentFilter,
} from "../customers/-components/CustomerShipmentTable";

function normalizeShipmentStatusFilter(
  value: unknown,
  fallback: ShipmentFilter = "all",
): ShipmentFilter {
  return value === "received" || value === "shipped" || value === "all"
    ? value
    : fallback;
}

export const Route = createFileRoute("/customer-shipments/$customerId")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>) => ({
    status: normalizeShipmentStatusFilter(search["status"]),
  }),
  component: CustomerShipmentDetailPage,
});

function CustomerShipmentDetailPage(): React.ReactElement {
  const { customerId } = Route.useParams();
  const { status } = Route.useSearch();
  const {
    data: customer,
    isLoading,
    error,
  } = useCustomer(customerId);

  if (isLoading) {
    return <CustomerShipmentDetailSkeleton />;
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 720 }}>
        <Alert severity="error">
          {error instanceof Error ? error.message : "載入客戶出貨資料失敗"}
        </Alert>
      </Box>
    );
  }

  if (!customer) {
    return (
      <Box sx={{ maxWidth: 720 }}>
        <Alert severity="warning">找不到該客戶</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        section="客戶出貨"
        current={customer.name}
        title={`${customer.name} 出貨管理`}
      />

      <CustomerShipmentTable
        customerId={customer.id}
        customerName={customer.name}
        initialStatusFilter={status}
      />
      <CustomerMergePanel customerId={customer.id} customerName={customer.name} />
    </Stack>
  );
}

function CustomerShipmentDetailSkeleton(): React.ReactElement {
  return (
    <Stack spacing={3}>
      <Box>
        <Skeleton variant="text" width={180} height={28} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={240} height={40} />
      </Box>
      <Skeleton variant="rectangular" height={360} />
      <Skeleton variant="rectangular" height={320} />
    </Stack>
  );
}
