import { PageHeader } from "@/components/PageHeader";
import { useUploadProductImagesBatch } from "@/hooks/useProductImages";
import { useCreateProduct, useCreateVariant } from "@/hooks/useProducts";
import { client } from "@/lib/amplify-client";
import { requireAuth } from "@/lib/route-guards";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  isTranslationSupplier,
  parseSupplierTranslationPost,
} from "@shared/logic/translation-parser";
import { validateProduct } from "@shared/logic/validation";
import type { Supplier } from "@shared/models";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ProductCreateForm,
  type ProductCreateFormPrefill,
  type ProductCreateFormValues,
} from "./-components/ProductCreateForm";

export const Route = createFileRoute("/products/new")({
  beforeLoad: requireAuth,
  validateSearch: (search: Record<string, unknown>) => ({
    fromPost: search.fromPost === true || search.fromPost === "true",
  }),
  component: ProductNewPage,
});

function ProductNewPage() {
  const navigate = useNavigate();
  const { fromPost } = Route.useSearch();
  const createMutation = useCreateProduct();
  const createVariantMutation = useCreateVariant();
  const uploadImagesMutation = useUploadProductImagesBatch();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formInstanceKey, setFormInstanceKey] = useState(0);
  const [postPanelResetKey, setPostPanelResetKey] = useState(0);
  const [prefill, setPrefill] = useState<ProductCreateFormPrefill | null>(null);

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
    setPostPanelResetKey((prev) => prev + 1);
  };

  const productForm = (
    <ProductCreateForm
      key={formInstanceKey}
      layout={fromPost ? "splitDescription" : "default"}
      prefill={prefill}
      isSubmitting={
        createMutation.isPending ||
        createVariantMutation.isPending ||
        uploadImagesMutation.isPending
      }
      onCancel={() => void navigate({ to: "/products" })}
      onSubmit={handleSubmit}
    />
  );

  return (
    <Box sx={{ maxWidth: fromPost ? "none" : 900 }}>
      <PageHeader
        section="商品"
        current="新增"
        title={fromPost ? "從 FB 貼文新增" : "新增商品"}
      />

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

      {fromPost ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            alignItems: { xs: "start", lg: "stretch" },
            gridTemplateColumns: {
              xs: "1fr",
              lg: "minmax(320px, 0.8fr) minmax(900px, 2.2fr)",
            },
          }}
        >
          <Box sx={{ alignSelf: { lg: "stretch" } }}>
            <ProductPostParserPanel
              resetKey={postPanelResetKey}
              onApply={(values) => {
                setSubmitError(null);
                setPrefill(values);
              }}
            />
          </Box>
          {productForm}
        </Box>
      ) : (
        <Stack spacing={3}>{productForm}</Stack>
      )}
    </Box>
  );
}

function ProductPostParserPanel({
  resetKey,
  onApply,
}: {
  resetKey: number;
  onApply: (values: ProductCreateFormPrefill) => void;
}): React.ReactElement {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [postContent, setPostContent] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseMessage, setParseMessage] = useState<string | null>(null);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "translation-parser-options"],
    queryFn: async () => {
      const { data, errors } = await client.models.Supplier.list({
        filter: { isActive: { eq: true } },
        limit: 200,
      });
      if (errors && errors.length > 0) {
        throw new Error(errors[0]?.message ?? "查詢供應商失敗");
      }

      return (data ?? []).map((raw) =>
        mapSupplier(raw as unknown as Record<string, unknown>),
      );
    },
    staleTime: 60_000,
  });

  const translationParser = selectedSupplier?.translationParser ?? null;
  const supplierOptions = suppliersQuery.data ?? [];
  const supplierLoadError =
    suppliersQuery.error instanceof Error
      ? suppliersQuery.error.message
      : "查詢供應商失敗";
  const supplierParserError =
    selectedSupplier && !translationParser
      ? "此供應商尚未設定貼文解析器，請先到供應商資料設定後再解析。"
      : null;

  const handleClearPost = (): void => {
    setPostContent("");
    setParseError(null);
    setParseMessage(null);
  };

  useEffect(() => {
    setPostContent("");
    setParseError(null);
    setParseMessage(null);
  }, [resetKey]);

  const handleParse = (): void => {
    setParseError(null);
    setParseMessage(null);

    if (!selectedSupplier) {
      setParseError("請先選擇供應商");
      return;
    }

    if (!translationParser) {
      setParseError("此供應商尚未設定貼文解析器");
      return;
    }

    if (!postContent.trim()) {
      setParseError("請先貼上 FB 貼文內容");
      return;
    }

    try {
      const result = parseSupplierTranslationPost(
        translationParser,
        postContent,
      );
      const prefill: ProductCreateFormPrefill = {
        name: result.name ?? "",
        description: result.description ?? "",
        price: result.price && result.price > 0 ? result.price : 0,
        cost: result.cost && result.cost > 0 ? result.cost : 0,
        variantInput: formatParsedOptions(result.option),
        supplier: selectedSupplier,
      };

      onApply(prefill);
      setParseMessage(
        result.name
          ? "已解析貼文並填入商品表單，請確認欄位後送出；SKU 會在建立時自動產生。"
          : "已完成解析，但未抓到商品名稱，請手動補上表單欄位。",
      );
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "解析 FB 貼文失敗");
    }
  };

  return (
    <Paper sx={{ p: 2, height: { lg: "100%" } }}>
      <Stack spacing={1.5} sx={{ height: { lg: "100%" } }}>
        <Stack spacing={0.5}>
          <Typography variant="h6">FB 貼文解析</Typography>
          <Typography variant="body2" color="text.secondary">
            選擇供應商後貼上貼文內容，系統會用對應的解析器預填商品資料。
          </Typography>
        </Stack>

        {parseError && (
          <Alert severity="error" onClose={() => setParseError(null)}>
            {parseError}
          </Alert>
        )}
        {supplierParserError && (
          <Alert severity="warning">{supplierParserError}</Alert>
        )}
        {parseMessage && (
          <Alert severity="success" onClose={() => setParseMessage(null)}>
            {parseMessage}
          </Alert>
        )}

        <FormControl
          fullWidth
          error={!!supplierParserError || suppliersQuery.isError}
          disabled={suppliersQuery.isLoading}
        >
          <InputLabel id="post-supplier-label">供應商 *</InputLabel>
          <Select
            labelId="post-supplier-label"
            label="供應商 *"
            value={selectedSupplier?.id ?? ""}
            onChange={(event) => {
              const supplier =
                supplierOptions.find(
                  (option) => option.id === event.target.value,
                ) ?? null;
              setSelectedSupplier(supplier);
              setParseError(null);
              setParseMessage(null);
            }}
            endAdornment={
              suppliersQuery.isFetching ? (
                <CircularProgress
                  color="inherit"
                  size={20}
                  sx={{ mr: 3 }}
                />
              ) : undefined
            }
          >
            {supplierOptions.length === 0 && (
              <MenuItem value="" disabled>
                {suppliersQuery.isLoading ? "載入中..." : "無可用供應商"}
              </MenuItem>
            )}
            {supplierOptions.map((supplier) => (
              <MenuItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </MenuItem>
            ))}
          </Select>
          {(supplierParserError || suppliersQuery.isError) && (
            <FormHelperText>
              {supplierParserError ?? supplierLoadError}
            </FormHelperText>
          )}
        </FormControl>

        <Box
          sx={{
            flex: { lg: 1 },
            "& .MuiFormControl-root": { height: { lg: "100%" } },
            "& .MuiInputBase-root": {
              alignItems: "flex-start",
              height: { lg: "100%" },
            },
            "& textarea": { height: { lg: "100% !important" } },
          }}
        >
          <TextField
            label="FB 貼文內容"
            value={postContent}
            onChange={(event) => setPostContent(event.target.value)}
            multiline
            minRows={8}
            fullWidth
          />
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="text"
            startIcon={<CleaningServicesIcon />}
            onClick={handleClearPost}
            disabled={!postContent}
          >
            清除貼文內容
          </Button>
          <Button
            variant="contained"
            onClick={handleParse}
            disabled={
              !selectedSupplier || !translationParser || !postContent.trim()
            }
          >
            解析並填入表單
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

function mapSupplier(raw: Record<string, unknown>): Supplier {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    contactPerson: String(raw.contactPerson ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    address: String(raw.address ?? ""),
    translationParser:
      typeof raw.translationParser === "string" &&
      isTranslationSupplier(raw.translationParser)
        ? raw.translationParser
        : null,
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function formatParsedOptions(options?: string[][]): string {
  if (!options || options.length === 0) {
    return "";
  }

  return options
    .map((group) => group.map((option) => option.trim()).filter(Boolean))
    .filter((group) => group.length > 0)
    .map((group) => group.join("，"))
    .join("/");
}
