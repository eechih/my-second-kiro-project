import { EntitySelect } from "@/components/EntitySelect";
import { VariantSelect } from "@/components/VariantSelect";
import { useProduct } from "@/hooks/useProducts";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { calculateLineItemSubtotal } from "@shared/logic/order-calculations";
import { resolveEffectivePrice } from "@shared/logic/product-variant";
import type { Product, ProductVariant } from "@shared/models";
import { useCallback, useEffect, useState } from "react";
import type { LineItemFormData } from "./formTypes";
import { searchProducts } from "./search";

export interface LineItemRowProps {
  item: LineItemFormData;
  index: number;
  onRemove: () => void;
  onUpdate: (updates: Partial<LineItemFormData>) => void;
}

export function LineItemRow({
  item,
  index,
  onRemove,
  onUpdate,
}: LineItemRowProps): React.ReactElement {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null,
  );
  const [variantError, setVariantError] = useState<string | undefined>();

  const { data: productDetail } = useProduct(item.productId || "");

  useEffect(() => {
    if (productDetail && productDetail.id === item.productId) {
      setSelectedProduct(productDetail);
    }
  }, [productDetail, item.productId]);

  const handleProductChange = useCallback(
    (product: Product | null) => {
      setSelectedProduct(product);
      setSelectedVariant(null);
      setVariantError(undefined);

      if (product) {
        onUpdate({
          productId: product.id,
          productName: product.name,
          variantId: null,
          variantLabel: null,
          unitPrice: product.price,
        });
      } else {
        onUpdate({
          productId: "",
          productName: "",
          variantId: null,
          variantLabel: null,
          unitPrice: 0,
        });
      }
    },
    [onUpdate],
  );

  const handleVariantChange = useCallback(
    (variant: ProductVariant | null) => {
      setSelectedVariant(variant);

      if (variant && selectedProduct) {
        setVariantError(undefined);
        onUpdate({
          variantId: variant.id,
          variantLabel: variant.label,
          unitPrice: resolveEffectivePrice(variant, selectedProduct),
        });
      } else {
        onUpdate({
          variantId: null,
          variantLabel: null,
          unitPrice: selectedProduct?.price ?? 0,
        });
        if (selectedProduct && selectedProduct.variants.length > 0) {
          setVariantError("請選取規格組合");
        }
      }
    },
    [onUpdate, selectedProduct],
  );

  const subtotal = calculateLineItemSubtotal(item.quantity, item.unitPrice);
  const hasVariants = selectedProduct
    ? selectedProduct.variants.length > 0
    : false;

  return (
    <TableRow>
      <TableCell sx={{ width: 40 }}>{index + 1}</TableCell>
      <TableCell sx={{ minWidth: 200 }}>
        <EntitySelect<Product>
          label="商品"
          value={selectedProduct}
          onChange={handleProductChange}
          searchFn={searchProducts}
          getOptionLabel={(product) => `${product.name}（${product.sku}）`}
          required
          error={!item.productId ? "請選取商品" : undefined}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        {hasVariants ? (
          <VariantSelect
            productId={item.productId}
            variants={selectedProduct?.variants ?? []}
            value={selectedVariant}
            onChange={handleVariantChange}
            error={variantError}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ width: 100 }}>
        <TextField
          type="number"
          value={item.quantity}
          onChange={(event) =>
            onUpdate({
              quantity: Math.max(1, parseInt(event.target.value, 10) || 1),
            })
          }
          size="small"
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 80 }}
        />
      </TableCell>
      <TableCell sx={{ width: 120 }}>
        <TextField
          type="number"
          value={item.unitPrice}
          onChange={(event) =>
            onUpdate({
              unitPrice: Math.max(0, Number(event.target.value) || 0),
            })
          }
          size="small"
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          sx={{ width: 100 }}
        />
      </TableCell>
      <TableCell sx={{ width: 100 }} align="right">
        {subtotal.toLocaleString()}
      </TableCell>
      <TableCell sx={{ width: 50 }}>
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
