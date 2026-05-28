import { client } from "@/lib/amplify-client";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { isTranslationSupplier } from "@shared/logic/translation-parser";
import type { Supplier } from "@shared/models";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

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

export function useSupplierOptions() {
  return useQuery({
    queryKey: ["suppliers", "select-options"],
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
}

export function SupplierSelect({
  label,
  value,
  onChange,
  suppliers,
  isLoading,
  isFetching,
  error,
}: {
  label: string;
  value: Supplier | null;
  onChange: (supplier: Supplier | null) => void;
  suppliers: Supplier[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
}): React.ReactElement {
  const errorMessage =
    error instanceof Error ? error.message : error ? "查詢供應商失敗" : "";

  return (
    <FormControl fullWidth error={!!error} disabled={isLoading}>
      <InputLabel id={`${label}-label`}>{label}</InputLabel>
      <Select
        labelId={`${label}-label`}
        label={label}
        value={value?.id ?? ""}
        onChange={(event) => {
          const supplier =
            suppliers.find((option) => option.id === event.target.value) ??
            null;
          onChange(supplier);
        }}
        endAdornment={
          isFetching ? (
            <CircularProgress color="inherit" size={20} sx={{ mr: 3 }} />
          ) : undefined
        }
      >
        <MenuItem value="">未指定</MenuItem>
        {suppliers.map((supplier) => (
          <MenuItem key={supplier.id} value={supplier.id}>
            {supplier.name}
          </MenuItem>
        ))}
      </Select>
      {errorMessage && <FormHelperText>{errorMessage}</FormHelperText>}
    </FormControl>
  );
}

export function ProductFormSection({
  title,
  description,
  children,
  sx,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  sx?: object;
}): React.ReactElement {
  return (
    <Paper sx={{ p: 2.5, ...sx }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h6">{title}</Typography>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}
