import { client } from "@/lib/amplify-client";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import CloseIcon from "@mui/icons-material/Close";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
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
import type { Supplier } from "@shared/models";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ProductCreateFormPrefill } from "./ProductCreateForm";

export const parserDrawerWidth = 440;
export const parserDrawerGap = 16;

interface ProductPostParserDrawerProps {
  isDesktop: boolean;
  open: boolean;
  resetKey: number;
  onApply: (values: ProductCreateFormPrefill) => void;
  onClose: () => void;
}

export function ProductPostParserDrawer({
  isDesktop,
  open,
  resetKey,
  onApply,
  onClose,
}: ProductPostParserDrawerProps): React.ReactElement {
  return (
    <>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          width: { md: open ? parserDrawerWidth : 0 },
          // flexShrink: 0,
          // overflow: "hidden",
          transition: (theme) =>
            theme.transitions.create("width", {
              duration: theme.transitions.duration.standard,
              easing: theme.transitions.easing.easeInOut,
            }),
        }}
      >
        <Paper
          elevation={1}
          sx={{
            width: parserDrawerWidth,
            flexShrink: 0,
            boxSizing: "border-box",
            p: 2,
            transform: open
              ? "translateX(0)"
              : `translateX(-${parserDrawerWidth}px)`,
            transition: (theme) =>
              theme.transitions.create("transform", {
                duration: theme.transitions.duration.standard,
                easing: theme.transitions.easing.easeInOut,
              }),
          }}
        >
          <ProductPostParserPanel
            resetKey={resetKey}
            onApply={onApply}
            fillHeight={false}
          />
        </Paper>
      </Box>

      {!isDesktop && (
        <Drawer
          anchor="right"
          open={open}
          onClose={onClose}
          slotProps={{
            paper: {
              sx: {
                width: { xs: "100%", sm: 440 },
                maxWidth: "100%",
              },
            },
          }}
        >
          <DrawerHeader onClose={onClose} />
          <Box sx={{ p: 2 }}>
            <ProductPostParserPanel
              resetKey={resetKey}
              onApply={onApply}
              fillHeight
            />
          </Box>
        </Drawer>
      )}
    </>
  );
}

function DrawerHeader({
  onClose,
}: {
  onClose: () => void;
}): React.ReactElement {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="h6">FB 貼文解析</Typography>
      <IconButton aria-label="關閉 FB 貼文解析" onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </Box>
  );
}

function ProductPostParserPanel({
  resetKey,
  onApply,
  fillHeight,
}: {
  resetKey: number;
  onApply: (values: ProductCreateFormPrefill) => void;
  fillHeight: boolean;
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
        mapSupplier(raw as Record<string, unknown>),
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

  useEffect(() => {
    setSelectedSupplier(null);
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
      onApply({
        name: result.name ?? "",
        description: result.description ?? "",
        price: result.price && result.price > 0 ? result.price : 0,
        cost: result.cost && result.cost > 0 ? result.cost : 0,
        variantInput: formatParsedOptions(result.option),
        supplier: selectedSupplier,
      });
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
    <Box sx={{ height: fillHeight ? "100%" : "auto" }}>
      <Stack spacing={1.5} sx={{ height: fillHeight ? "100%" : "auto" }}>
        <Typography variant="body2" color="text.secondary">
          選擇供應商後貼上貼文內容，系統會用對應的解析器預填商品資料。
        </Typography>

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
                <CircularProgress color="inherit" size={20} sx={{ mr: 3 }} />
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
            flex: fillHeight ? 1 : "initial",
            "& .MuiFormControl-root": {
              height: fillHeight ? "100%" : "auto",
            },
            "& .MuiInputBase-root": {
              alignItems: "flex-start",
              height: fillHeight ? "100%" : "auto",
            },
            "& textarea": fillHeight
              ? { height: "100% !important" }
              : undefined,
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
            onClick={() => {
              setPostContent("");
              setParseError(null);
              setParseMessage(null);
            }}
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
    </Box>
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
