import { PageHeader } from "@/components/PageHeader";
import { useUploadProductImagesBatch } from "@/hooks/useProductImages";
import { useCreateProduct, useCreateVariant } from "@/hooks/useProducts";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { validateProduct } from "@shared/logic/validation";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProductCreateActions } from "./-components/ProductCreateActions";
import {
  ProductPostParserDrawer,
  parserDrawerGap,
  parserDrawerWidth,
} from "./-components/ProductPostParserDrawer";
import {
  ProductCreateForm,
  type ProductCreateFormPrefill,
  type ProductCreateFormValues,
} from "./-components/ProductCreateForm";

export const Route = createFileRoute("/products/new")({
  beforeLoad: requireAuth,
  component: ProductNewPage,
});

const productCreateFormId = "product-create-form";

function ProductNewPage() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const navigate = useNavigate();
  const createMutation = useCreateProduct();
  const createVariantMutation = useCreateVariant();
  const uploadImagesMutation = useUploadProductImagesBatch();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formInstanceKey, setFormInstanceKey] = useState(0);
  const [parserResetKey, setParserResetKey] = useState(0);
  const [prefill, setPrefill] = useState<ProductCreateFormPrefill | null>(null);
  const [isParserOpen, setIsParserOpen] = useState(false);

  const handleSubmit = async (
    values: ProductCreateFormValues,
  ): Promise<void> => {
    setSubmitError(null);
    setSubmitSuccess(false);

    const validation = validateProduct({
      name: values.name,
      price: values.price,
      cost: values.cost,
    });
    if (!validation.valid) {
      setSubmitError(validation.error ?? "驗證失敗");
      return;
    }

    try {
      const product = await createMutation.mutateAsync(values);
      await Promise.all(
        values.variants.map((variant) =>
          createVariantMutation.mutateAsync({
            productId: product.id,
            variant,
          }),
        ),
      );
      await uploadImagesMutation.mutateAsync({
        productId: product.id,
        files: values.imageFiles,
      });
      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "建立商品失敗");
    }
  };

  const handleContinueCreate = (): void => {
    setSubmitSuccess(false);
    setSubmitError(null);
    setPrefill(null);
    setFormInstanceKey((prev) => prev + 1);
    setParserResetKey((prev) => prev + 1);
    setIsParserOpen(false);
  };

  return (
    <Box>
      <PageHeader section="商品" current="新增" title="新增商品" />

      <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
        <ProductCreateActions
          formId={productCreateFormId}
          isParserOpen={isParserOpen}
          isSubmitting={
            createMutation.isPending ||
            createVariantMutation.isPending ||
            uploadImagesMutation.isPending
          }
          onCancel={() => void navigate({ to: "/products" })}
          onOpenParser={() => setIsParserOpen(true)}
        />
      </Box>

      {submitError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setSubmitError(null)}
        >
          {submitError}
        </Alert>
      )}

      {submitSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                size="small"
                onClick={() => void navigate({ to: "/products" })}
              >
                前往商品列表
              </Button>
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                onClick={handleContinueCreate}
              >
                繼續新增
              </Button>
            </Stack>
          }
        >
          商品已新增完成。
        </Alert>
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          columnGap: { md: isParserOpen ? `${parserDrawerGap}px` : "0px" },
          transition: (muiTheme) =>
            muiTheme.transitions.create("column-gap", {
              duration: muiTheme.transitions.duration.standard,
              easing: muiTheme.transitions.easing.easeInOut,
            }),
        }}
      >
        <ProductPostParserDrawer
          isDesktop={isDesktop}
          open={isParserOpen}
          resetKey={parserResetKey}
          onApply={(values) => {
            setSubmitError(null);
            setPrefill(values);
          }}
          onClose={() => setIsParserOpen(false)}
        />

        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            width: {
              md: isParserOpen
                ? `calc(100% - ${parserDrawerWidth}px - ${parserDrawerGap}px)`
                : "100%",
            },
            transition: (muiTheme) =>
              muiTheme.transitions.create("width", {
                duration: muiTheme.transitions.duration.standard,
                easing: muiTheme.transitions.easing.easeInOut,
              }),
          }}
        >
          <Stack spacing={3}>
            <ProductCreateForm
              key={formInstanceKey}
              formId={productCreateFormId}
              layout="splitDescription"
              prefill={prefill}
              onSubmit={handleSubmit}
            />
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
