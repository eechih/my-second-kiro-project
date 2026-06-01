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

const SAVING_LABEL = "保存中";
const EDITOR_SX = {
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
} as const;

function InlineSavingIndicator(): React.ReactElement {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <CircularProgress size={16} />
      <Typography variant="body2" color="text.secondary">
        {SAVING_LABEL}
      </Typography>
    </Box>
  );
}

function SavingAdornment(): React.ReactElement {
  return (
    <InputAdornment position="end">
      <CircularProgress size={16} />
    </InputAdornment>
  );
}

interface EditableDisplayProps {
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "body1" | "body2";
  color?: string;
  sx?: object;
  onOpen: () => void;
}

function EditableDisplay({
  children,
  disabled = false,
  variant,
  color,
  sx,
  onOpen,
}: EditableDisplayProps): React.ReactElement {
  return (
    <Typography
      role="button"
      tabIndex={0}
      variant={variant}
      color={color}
      sx={{ cursor: disabled ? "default" : "text", ...sx }}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !disabled) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
    </Typography>
  );
}

interface SavingCommitState {
  isSaving: boolean;
  isSavingRef: React.MutableRefObject<boolean>;
  runSavingCommit: (task: () => Promise<void>) => Promise<void>;
}

function useSavingCommit(): SavingCommitState {
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const runSavingCommit = async (task: () => Promise<void>): Promise<void> => {
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await task();
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return { isSaving, isSavingRef, runSavingCommit };
}

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
  const { isSaving, isSavingRef, runSavingCommit } = useSavingCommit();

  const commit = async (): Promise<void> => {
    if (isSavingRef.current) return;

    const nextValue = draft.trim();
    if (nextValue === value) {
      setIsEditing(false);
      return;
    }

    await runSavingCommit(async () => {
      await onCommit(nextValue);
      setIsEditing(false);
    });
  };

  if (isSaving) {
    return <InlineSavingIndicator />;
  }

  if (isEditing) {
    return (
      <TextField
        value={draft}
        size="small"
        variant="outlined"
        autoFocus
        fullWidth
        sx={EDITOR_SX}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (!isSavingRef.current) {
            setDraft(value);
            setIsEditing(false);
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape" && !isSavingRef.current) {
            setDraft(value);
            setIsEditing(false);
          }
        }}
      />
    );
  }

  return (
    <EditableDisplay
      sx={textSx}
      onOpen={() => {
        setDraft(value);
        setIsEditing(true);
      }}
    >
      {value || emptyLabel}
    </EditableDisplay>
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
  const { isSaving, isSavingRef, runSavingCommit } = useSavingCommit();

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

    await runSavingCommit(async () => {
      await onCommit(nextValue);
      setIsEditing(false);
    });
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
        value={isSaving ? SAVING_LABEL : draft}
        size="small"
        variant="outlined"
        type={isSaving ? "text" : "number"}
        autoFocus
        fullWidth
        disabled={isSaving}
        slotProps={{
          htmlInput: {
            min: 0,
            step: integer ? 1 : 0.01,
            style: align ? { textAlign: align } : undefined,
          },
          input: {
            endAdornment: isSaving ? <SavingAdornment /> : undefined,
          },
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (!isSavingRef.current) void commit();
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape" && !isSavingRef.current) {
            setDraft(String(value));
            setIsEditing(false);
          }
        }}
        sx={EDITOR_SX}
      />
    );
  }

  return (
    <EditableDisplay
      sx={{ textAlign: align }}
      onOpen={() => {
        setDraft(String(value));
        setIsEditing(true);
      }}
    >
      {format(value)}
    </EditableDisplay>
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
  const { isSaving, isSavingRef, runSavingCommit } = useSavingCommit();

  const commit = async (nextIsActive: boolean): Promise<void> => {
    if (isSavingRef.current) return;

    if (nextIsActive === isActive) {
      setIsEditing(false);
      return;
    }

    await runSavingCommit(async () => {
      await onCommit(nextIsActive);
      setIsEditing(false);
    });
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
          renderValue={() =>
            isSaving ? SAVING_LABEL : isActive ? "啟用中" : "已停用"
          }
          sx={{
            ...EDITOR_SX,
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
    <EditableDisplay
      variant="body2"
      disabled={disabled}
      sx={{
        color: isActive ? "success.main" : "error.main",
        fontWeight: 500,
      }}
      onOpen={() => setIsEditing(true)}
    >
      {isActive ? "啟用中" : "已停用"}
    </EditableDisplay>
  );
}

interface EditableSelectOption {
  value: string;
  label: string;
}

interface EditableSelectCellProps {
  value: string | null;
  valueLabel?: string;
  emptyLabel?: string;
  placeholder?: string;
  options: EditableSelectOption[];
  onCommit: (value: string | null) => Promise<void>;
}

export function EditableSelectCell({
  value,
  valueLabel,
  emptyLabel = "—",
  placeholder = "未指定",
  options,
  onCommit,
}: EditableSelectCellProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const { isSaving, isSavingRef, runSavingCommit } = useSavingCommit();

  const commit = async (nextValue: string | null): Promise<void> => {
    if (isSavingRef.current) return;

    if (nextValue === value) {
      setIsEditing(false);
      return;
    }

    await runSavingCommit(async () => {
      await onCommit(nextValue);
      setIsEditing(false);
    });
  };

  if (isEditing) {
    return (
      <Box>
        <Select
          value={value ?? ""}
          size="small"
          variant="outlined"
          autoFocus
          open
          disabled={isSaving}
          renderValue={(selected) => {
            if (isSaving) return SAVING_LABEL;
            const selectedOption = options.find(
              (option) => option.value === selected,
            );
            return selectedOption?.label ?? placeholder;
          }}
          sx={EDITOR_SX}
          onClick={(event) => event.stopPropagation()}
          onClose={() => {
            if (!isSavingRef.current) setIsEditing(false);
          }}
          onChange={(event) => {
            const nextValue = event.target.value || null;
            void commit(nextValue);
          }}
        >
          <MenuItem value="">{placeholder}</MenuItem>
          {options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    );
  }

  return (
    <EditableDisplay
      variant="body2"
      color={value ? "text.primary" : "text.secondary"}
      onOpen={() => setIsEditing(true)}
    >
      {valueLabel ?? emptyLabel}
    </EditableDisplay>
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
  const { isSaving, isSavingRef, runSavingCommit } = useSavingCommit();

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

    await runSavingCommit(async () => {
      await onCommit(nextValueId);
      setIsEditing(false);
    });
  };

  if (isEditing) {
    return (
      <Autocomplete
        open
        size="small"
        value={value}
        options={options}
        inputValue={isSaving ? SAVING_LABEL : inputValue}
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
        sx={EDITOR_SX}
      />
    );
  }

  return (
    <EditableDisplay
      variant="body2"
      color={valueId ? "text.primary" : "text.secondary"}
      onOpen={openEditor}
    >
      {valueLabel ?? emptyLabel}
    </EditableDisplay>
  );
}
