import {
  EditableNumberCell,
  EditableSelectCell,
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
  | "price"
  | "cost"
  | "stockQuantity"
  | "defaultSupplierId"
  | "preorderStatus"
  | "isActive";

export interface SupplierOption {
  id: string;
  name: string;
}

export interface ProductTableRowProps {
  productId: string;
  selected: boolean;
  supplierOptions: SupplierOption[];
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
  supplierOptions,
  onSelect,
  onEdit,
  onCellEdit,
}: ProductTableRowProps): React.ReactElement {
  const PREORDER_STATUS_LABEL: Record<string, string> = {
    DRAFT: "草稿",
    OPEN: "開放中",
    CLOSED: "已截止",
  };

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
        <TableCell padding="checkbox" sx={{ width: 40, px: 0.5 }}>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(productId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={10}>
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
        <TableCell padding="checkbox" sx={{ width: 40, px: 0.5 }}>
          <Checkbox
            checked={selected}
            onChange={() => onSelect(productId)}
            size="small"
          />
        </TableCell>
        <TableCell colSpan={10}>
          <Alert severity="error">
            {error instanceof Error ? error.message : "查詢商品失敗"}
          </Alert>
        </TableCell>
      </TableRow>
    );
  }

  const preorderCloseDate = product.preorderCloseAt
    ? new Date(product.preorderCloseAt).toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";
  const preorderStatusLabel = product.preorderStatus
    ? PREORDER_STATUS_LABEL[product.preorderStatus] ?? product.preorderStatus
    : "未設定";

  return (
    <TableRow selected={selected} hover>
      <TableCell padding="checkbox" sx={{ width: 40, px: 0.5 }}>
        <Checkbox
          checked={selected}
          onChange={() => onSelect(product.id)}
          size="small"
        />
      </TableCell>
      <TableCell align="left" sx={{ width: 60, px: 1, whiteSpace: "nowrap" }}>
        {product.sequenceNumber}
      </TableCell>
      <TableCell align="center" sx={{ width: 52, px: 1, whiteSpace: "nowrap" }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Avatar
            variant="rounded"
            src={thumbnailUrl}
            sx={{ width: 40, height: 40 }}
          >
            <ImageIcon fontSize="small" />
          </Avatar>
        </Box>
      </TableCell>
      <TableCell sx={{ minWidth: 240 }}>
        <EditableTextCell
          value={product.name}
          textSx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          onCommit={(value) => onCellEdit(product, "name", value)}
        />
      </TableCell>
      <TableCell align="right" sx={{ width: 84, px: 1, whiteSpace: "nowrap" }}>
        <EditableNumberCell
          value={product.price}
          format={(value) => `$${value}`}
          integer
          align="right"
          onCommit={(value) => onCellEdit(product, "price", value)}
        />
      </TableCell>
      <TableCell align="right" sx={{ width: 84, px: 1, whiteSpace: "nowrap" }}>
        <EditableNumberCell
          value={product.stockQuantity}
          integer
          align="right"
          onCommit={(value) => onCellEdit(product, "stockQuantity", value)}
        />
      </TableCell>
      <TableCell
        align="center"
        sx={{ width: 112, px: 1, whiteSpace: "nowrap" }}
      >
        <EditableSelectCell
          value={supplierId ?? null}
          valueLabel={supplierId ? supplierName : undefined}
          placeholder="未指定"
          options={supplierOptions.map((supplier) => ({
            value: supplier.id,
            label: supplier.name,
          }))}
          onCommit={(value) => onCellEdit(product, "defaultSupplierId", value)}
        />
      </TableCell>
      <TableCell align="right" sx={{ width: 96, px: 1, whiteSpace: "nowrap" }}>
        <EditableNumberCell
          value={product.cost}
          format={(value) => `$${value}`}
          integer
          align="right"
          onCommit={(value) => onCellEdit(product, "cost", value)}
        />
      </TableCell>
      <TableCell
        align="center"
        sx={{ width: 104, px: 1, whiteSpace: "nowrap" }}
      >
        {preorderCloseDate}
      </TableCell>
      <TableCell align="center" sx={{ width: 88, px: 1, whiteSpace: "nowrap" }}>
        <EditableSelectCell
          value={product.preorderStatus}
          valueLabel={preorderStatusLabel}
          placeholder="未設定"
          options={[
            { value: "DRAFT", label: "草稿" },
            { value: "OPEN", label: "開放中" },
            { value: "CLOSED", label: "已截止" },
          ]}
          onCommit={(value) => onCellEdit(product, "preorderStatus", value)}
        />
      </TableCell>
      <TableCell align="center" sx={{ width: 56, px: 0.5, whiteSpace: "nowrap" }}>
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
