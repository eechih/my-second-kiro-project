import { ListToolbar, type ListToolbarOption } from "@/components/ListToolbar";
import type { SupplierReceivingStatusFilter } from "@/hooks/useSupplierReceivings";

export type { SupplierReceivingStatusFilter } from "@/hooks/useSupplierReceivings";

export const SUPPLIER_RECEIVING_STATUS_OPTIONS = [
  { value: "ordered", label: "待入庫" },
  { value: "all", label: "全部" },
] satisfies readonly ListToolbarOption<SupplierReceivingStatusFilter>[];

export interface SupplierReceivingsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalCount: number;
  statusFilter: SupplierReceivingStatusFilter;
  onStatusFilterChange: (value: SupplierReceivingStatusFilter) => void;
}

export function SupplierReceivingsToolbar({
  search,
  onSearchChange,
  totalCount,
  statusFilter,
  onStatusFilterChange,
}: SupplierReceivingsToolbarProps): React.ReactElement {
  return (
    <ListToolbar
      search={search}
      onSearchChange={onSearchChange}
      totalCount={totalCount}
      statusSelect={{
        value: statusFilter,
        onChange: onStatusFilterChange,
        options: SUPPLIER_RECEIVING_STATUS_OPTIONS,
        ariaLabel: "篩選供應商入庫狀態",
      }}
    />
  );
}
