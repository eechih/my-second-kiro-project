import { EntitySelect } from "@/components/EntitySelect";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { Customer } from "@shared/models";
import { searchCustomers } from "./orderSearch";

export interface OrderCustomerSectionProps {
  selectedCustomer: Customer | null;
  showError: boolean;
  onCustomerChange: (customer: Customer | null) => void;
}

export function OrderCustomerSection({
  selectedCustomer,
  showError,
  onCustomerChange,
}: OrderCustomerSectionProps): React.ReactElement {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        客戶資訊
      </Typography>
      <EntitySelect<Customer>
        label="客戶"
        value={selectedCustomer}
        onChange={onCustomerChange}
        searchFn={searchCustomers}
        getOptionLabel={(customer) =>
          `${customer.name}（${customer.contactPerson}）`
        }
        required
        error={showError ? "請選取客戶" : undefined}
      />
    </Paper>
  );
}
