import { PageHeader } from "@/components/PageHeader";
import { requireAuth } from "@/lib/route-guards";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SupplierReceivingTable } from "../suppliers/-components/SupplierReceivingTable";

export const Route = createFileRoute("/supplier-receivings/$supplierName")({
  beforeLoad: requireAuth,
  component: SupplierReceivingDetailPage,
});

function SupplierReceivingDetailPage(): React.ReactElement {
  const { supplierName } = Route.useParams();
  const navigate = useNavigate();

  return (
    <Box>
      <PageHeader
        section="供應商入庫"
        current={supplierName}
        title="入庫明細"
        actions={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => void navigate({ to: "/supplier-receivings" })}
          >
            返回
          </Button>
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        目前顯示「{supplierName}」的全部入庫明細。
      </Alert>

      <SupplierReceivingTable supplierName={supplierName} />
    </Box>
  );
}
