import { EntitySelect } from "@/components/EntitySelect";
import { client } from "@/lib/amplify-client";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export interface CustomerOption {
  id: string;
  name: string;
}

export interface MergeCustomerSectionProps {
  selectedCustomer: CustomerOption | null;
  onCustomerChange: (customer: CustomerOption | null) => void;
}

async function searchCustomers(query: string): Promise<CustomerOption[]> {
  const filter: Record<string, unknown> = { isActive: { eq: true } };
  if (query) {
    filter.or = [
      { name: { contains: query } },
      { contactPerson: { contains: query } },
    ];
  }

  const { data } = await client.models.Customer.list({
    filter,
    limit: 20,
  });

  return (data ?? []).map((customer) => ({
    id: String(customer.id ?? ""),
    name: String(customer.name ?? ""),
  }));
}

export function MergeCustomerSection({
  selectedCustomer,
  onCustomerChange,
}: MergeCustomerSectionProps): React.ReactElement {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        步驟 1：選取客戶
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        僅能合併同一客戶的訂單，請先選取客戶。
      </Typography>
      <Box sx={{ maxWidth: 400 }}>
        <EntitySelect<CustomerOption>
          label="客戶"
          value={selectedCustomer}
          onChange={onCustomerChange}
          searchFn={searchCustomers}
          getOptionLabel={(option) => option.name}
          required
        />
      </Box>
    </Paper>
  );
}
