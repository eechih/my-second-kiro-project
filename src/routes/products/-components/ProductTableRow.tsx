import {
  EditableAutocompleteCell,
  EditableNumberCell,
  EditableStatusCell,
  EditableTextCell,
} from "@/components/EditableCell";
import { useProductThumbnailUrl } from "@/hooks/useProductImages";
import { useProduct } from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import EditIcon from "@mui/icons-material/Edit";
import ImageIcon from "@mui/icons-material/Image";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Product } from "@shared/models";
import { useQuery } from "@tanstack/react-query";

export type EditableProductField =
  | "name"
  | "unitPrice"
  | "defaultCost"
  | "stockQuantity"
  | "defaultSupplierId"
  | "isActive";

export interface SupplierOption {
  id: string;
  name: string;
}

export interface ProductTableRowProps {
  productId: string;
  selected: boolean;
  statusDisabled: boolean;
  searchSuppliers: (query: string) => Promise<SupplierOption[]>;
  onSelect: (productId: string) => void;
  onEdit: (product: Product) => void;
  onCellEdit: (
    product: Product,
    field: EditableProductField,
    value: string | number | boolean | null,
  ) => Promise<void>;
}

export function ProductTableRow({
  productId,
  selected,
  statusDisabled,
  searchSuppliers,
  onSelect,
  onEdit,
  onCellEdit,
}: ProductTableRowProps): React.ReactElement {
  const { data: product, isLoading, error } = useProduct(productId);
  const firstImageKey = product?.imageUrls[0];
  const { data: thumbnailUrl } = useProductThumbnailUrl(firstImageKey);
  const supplierId = product?.defaultSupplierId;

  const { data: supplierName } = useQuery({
    queryKey: ["suppliers", "name", supplierId],
    queryFn: async (): Promise<string> => {
      if (!supplierId) return "";

      const { data: supplier } = await client.models.Supplier.get(
        { id: supplierId },
        { selectionSet: ["id", "name"] },
      );
      return String(supplier?.name ?? "");
    },
    enabled: !!supplierId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(productId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={9}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography color="text.secondary">載入商品資料中...</Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  if (error || !product) {
    return (
      <TableRow selected={selected} hover>
        <TableCell>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(productId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={9}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢商品失敗"}
          </Alert>
        </TableCell>
      </TableRow>
    );
  }

  const createdDate = product.createdAt
    ? new Date(product.createdAt).toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

  const totalStock = product.variants.reduce(
    (sum, variant) => sum + variant.stockQuantity,
    0,
  );

  return (
    <TableRow selected={selected} hover>
      <TableCell>
        <Checkbox
          checked={selected}
          onChange={() => onSelect(product.id)}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Avatar
          variant="rounded"
          src={thumbnailUrl}
          sx={{ width: 40, height: 40 }}
        >
          <ImageIcon fontSize="small" />
        </Avatar>
      </TableCell>
      <TableCell>
        <Box>
          <EditableTextCell
            value={product.name}
            onCommit={(value) => onCellEdit(product, "name", value)}
          />
          <Typography variant="body2" color="text.secondary">
            {product.sku}
          </Typography>
        </Box>
      </TableCell>
      <TableCell align="right">
        <EditableNumberCell
          value={product.unitPrice}
          format={(value) => `$${value}`}
          integer
          align="right"
          onCommit={(value) => onCellEdit(product, "unitPrice", value)}
        />
      </TableCell>
      <TableCell align="right">
        {product.variants.length > 0 ? (
          <EditableNumberCell
            value={totalStock}
            format={(value) => `${value}（${product.variants.length} 規格）`}
            disabled
            disabledText="有規格商品請到編輯頁調整各規格庫存"
            align="right"
            onCommit={async () => undefined}
          />
        ) : (
          <EditableNumberCell
            value={product.stockQuantity}
            integer
            align="right"
            onCommit={(value) => onCellEdit(product, "stockQuantity", value)}
          />
        )}
      </TableCell>
      <TableCell align="center">
        <EditableAutocompleteCell<SupplierOption>
          valueId={supplierId ?? null}
          valueLabel={supplierId ? supplierName : undefined}
          placeholder="搜尋供應商"
          noOptionsText="無符合供應商"
          searchOptions={searchSuppliers}
          onCommit={(value) => onCellEdit(product, "defaultSupplierId", value)}
        />
      </TableCell>
      <TableCell align="right">
        <EditableNumberCell
          value={product.defaultCost}
          format={(value) => `$${value}`}
          integer
          align="right"
          onCommit={(value) => onCellEdit(product, "defaultCost", value)}
        />
      </TableCell>
      <TableCell>{createdDate}</TableCell>
      <TableCell align="center">
        <EditableStatusCell
          isActive={product.isActive}
          disabled={statusDisabled}
          onCommit={(isActive) => onCellEdit(product, "isActive", isActive)}
        />
      </TableCell>
      <TableCell align="center">
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
          <Tooltip title="編輯">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(product);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
}
