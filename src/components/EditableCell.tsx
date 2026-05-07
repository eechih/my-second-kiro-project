import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";

interface EditableTextCellProps {
  value: string;
  emptyLabel?: string;
  textSx?: object;
  onCommit: (value: string) => Promise<void>;
}

export function EditableTextCell({
  value,
  emptyLabel = "—",
  textSx,
  onCommit,
}: EditableTextCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const commit = async (): Promise<void> => {
    if (isSavingRef.current) return;

    const nextValue = draft.trim();
    if (nextValue === value) {
      setIsEditing(false);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await onCommit(nextValue);
      setIsEditing(false);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <TextField
        value={isSaving ? "保存中" : draft}
        size="small"
        variant="outlined"
        autoFocus
        fullWidth
        disabled={isSaving}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            setDraft(value);
            setIsEditing(false);
          }
        }}
        slotProps={{
          input: {
            endAdornment: isSaving ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
    );
  }

  return (
    <Typography
      role="button"
      tabIndex={0}
      sx={{ cursor: "text", ...textSx }}
      onClick={(event) => {
        event.stopPropagation();
        setDraft(value);
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setDraft(value);
          setIsEditing(true);
        }
      }}
    >
      {value || emptyLabel}
    </Typography>
  );
}

interface EditableNumberCellProps {
  value: number;
  format?: (value: number) => string;
  integer?: boolean;
  disabled?: boolean;
  disabledText?: string;
  align?: "left" | "right" | "center";
  onCommit: (value: number) => Promise<void>;
}

export function EditableNumberCell({
  value,
  format = (nextValue) => String(nextValue),
  integer = false,
  disabled = false,
  disabledText,
  align,
  onCommit,
}: EditableNumberCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const commit = async (): Promise<void> => {
    if (isSavingRef.current) return;

    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      setIsEditing(false);
      return;
    }

    const nextValue = integer ? Math.trunc(parsed) : parsed;
    if (nextValue === value) {
      setIsEditing(false);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await onCommit(nextValue);
      setIsEditing(false);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  if (disabled) {
    return (
      <Tooltip title={disabledText ?? ""}>
        <Typography component="span" sx={{ textAlign: align }}>
          {format(value)}
        </Typography>
      </Tooltip>
    );
  }

  if (isEditing) {
    return (
      <TextField
        value={isSaving ? "保存中" : draft}
        size="small"
        variant="outlined"
        type={isSaving ? "text" : "number"}
        autoFocus
        disabled={isSaving}
        slotProps={{
          htmlInput: { min: 0, step: integer ? 1 : 0.01, style: align ? { textAlign: align } : undefined },
          input: {
            endAdornment: isSaving ? (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ) : undefined,
          },
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            setDraft(String(value));
            setIsEditing(false);
          }
        }}
        sx={{ width: 96 }}
      />
    );
  }

  return (
    <Typography
      role="button"
      tabIndex={0}
      sx={{ cursor: "text", textAlign: align }}
      onClick={(event) => {
        event.stopPropagation();
        setDraft(String(value));
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setDraft(String(value));
          setIsEditing(true);
        }
      }}
    >
      {format(value)}
    </Typography>
  );
}

interface EditableStatusCellProps {
  isActive: boolean;
  disabled?: boolean;
  onCommit: (isActive: boolean) => Promise<void>;
}

export function EditableStatusCell({
  isActive,
  disabled = false,
  onCommit,
}: EditableStatusCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const commit = async (nextIsActive: boolean): Promise<void> => {
    if (isSavingRef.current) return;

    if (nextIsActive === isActive) {
      setIsEditing(false);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await onCommit(nextIsActive);
      setIsEditing(false);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Box>
        <Select
          value={isActive ? "active" : "inactive"}
          size="small"
          variant="outlined"
          autoFocus
          open
          disabled={disabled || isSaving}
          renderValue={() => (isSaving ? "保存中" : isActive ? "啟用中" : "已停用")}
          sx={{
            minWidth: 88,
            color: isActive ? "success.main" : "error.main",
            "& .MuiSelect-select": {
              fontWeight: 500,
            },
          }}
          onClick={(event) => event.stopPropagation()}
          onClose={() => {
            if (!isSavingRef.current) setIsEditing(false);
          }}
          onChange={(event) => {
            void commit(event.target.value === "active");
          }}
        >
          <MenuItem value="active">啟用中</MenuItem>
          <MenuItem value="inactive">已停用</MenuItem>
        </Select>
      </Box>
    );
  }

  return (
    <Typography
      role="button"
      tabIndex={0}
      variant="body2"
      sx={{
        color: isActive ? "success.main" : "error.main",
        cursor: disabled ? "default" : "text",
        fontWeight: 500,
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !disabled) {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {isActive ? "啟用中" : "已停用"}
    </Typography>
  );
}

export interface EditableAutocompleteOption {
  id: string;
  name: string;
}

interface EditableAutocompleteCellProps<T extends EditableAutocompleteOption> {
  valueId: string | null;
  valueLabel?: string;
  emptyLabel?: string;
  placeholder: string;
  noOptionsText: string;
  searchOptions: (query: string) => Promise<T[]>;
  onCommit: (valueId: string | null) => Promise<void>;
}

export function EditableAutocompleteCell<T extends EditableAutocompleteOption>({
  valueId,
  valueLabel,
  emptyLabel = "—",
  placeholder,
  noOptionsText,
  searchOptions,
  onCommit,
}: EditableAutocompleteCellProps<T>): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const [value, setValue] = useState<T | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (!isEditing) return;

    let active = true;
    setIsLoading(true);
    void searchOptions(inputValue)
      .then((results) => {
        if (!active) return;
        setOptions(results);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [inputValue, isEditing, searchOptions]);

  const currentValue = valueId
    ? ({ id: valueId, name: valueLabel ?? "未命名項目" } as T)
    : null;

  const openEditor = (): void => {
    setValue(currentValue);
    setInputValue("");
    setIsEditing(true);
  };

  const commit = async (nextValue: T | null): Promise<void> => {
    if (isSavingRef.current) return;

    const nextValueId = nextValue?.id ?? null;
    if (nextValueId === valueId) {
      setIsEditing(false);
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await onCommit(nextValueId);
      setIsEditing(false);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Autocomplete
        open
        size="small"
        value={value}
        options={options}
        inputValue={isSaving ? "保存中" : inputValue}
        loading={isLoading}
        disabled={isSaving}
        clearOnBlur={false}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        getOptionLabel={(option) => option.name}
        noOptionsText={noOptionsText}
        loadingText="載入中..."
        onChange={(_event, nextValue) => {
          setValue(nextValue);
          void commit(nextValue);
        }}
        onClose={() => {
          if (!isSavingRef.current) setIsEditing(false);
        }}
        onInputChange={(_event, nextInputValue) => {
          setInputValue(nextInputValue);
        }}
        renderInput={(params) => {
          const { slotProps: paramSlotProps, ...restParams } = params;
          return (
            <TextField
              {...restParams}
              autoFocus
              variant="outlined"
              placeholder={placeholder}
              onClick={(event) => event.stopPropagation()}
              slotProps={{
                ...paramSlotProps,
                input: {
                  ...paramSlotProps?.input,
                  endAdornment: (
                    <>
                      {isLoading || isSaving ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : null}
                      {paramSlotProps?.input?.endAdornment}
                    </>
                  ),
                },
              }}
            />
          );
        }}
        sx={{ minWidth: 180 }}
      />
    );
  }

  return (
    <Typography
      role="button"
      tabIndex={0}
      variant="body2"
      color={valueId ? "text.primary" : "text.secondary"}
      sx={{ cursor: "text" }}
      onClick={(event) => {
        event.stopPropagation();
        openEditor();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          openEditor();
        }
      }}
    >
      {valueLabel ?? emptyLabel}
    </Typography>
  );
}
