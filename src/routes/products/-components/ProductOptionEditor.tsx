import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { CreateProductOptionInput } from "@shared/models";

export interface EditableProductOptionValue {
  name: string;
  priceOffset: number;
  costOffset: number;
}

export interface EditableProductOption {
  name: string;
  values: EditableProductOptionValue[];
}

interface ProductOptionEditorProps {
  value: EditableProductOption[];
  onChange: (value: EditableProductOption[]) => void;
}

export function mapEditableOptionsToCreateInput(
  options: EditableProductOption[],
): CreateProductOptionInput[] {
  return options.map((option, optionIndex) => ({
    name: option.name,
    sortOrder: optionIndex,
    values: option.values.map((optionValue, valueIndex) => ({
      name: optionValue.name,
      priceOffset: optionValue.priceOffset,
      costOffset: optionValue.costOffset,
      sortOrder: valueIndex,
    })),
  }));
}

export function ProductOptionEditor({
  value,
  onChange,
}: ProductOptionEditorProps): React.ReactElement {
  const updateOption = (
    optionIndex: number,
    updater: (option: EditableProductOption) => EditableProductOption,
  ): void => {
    onChange(value.map((option, index) => (index === optionIndex ? updater(option) : option)));
  };

  const addOption = (): void => {
    onChange([
      ...value,
      {
        name: "",
        values: [{ name: "", priceOffset: 0, costOffset: 0 }],
      },
    ]);
  };

  const removeOption = (optionIndex: number): void => {
    onChange(value.filter((_, index) => index !== optionIndex));
  };

  const addValue = (optionIndex: number): void => {
    updateOption(optionIndex, (option) => ({
      ...option,
      values: [
        ...option.values,
        { name: "", priceOffset: 0, costOffset: 0 },
      ],
    }));
  };

  const removeValue = (optionIndex: number, valueIndex: number): void => {
    updateOption(optionIndex, (option) => ({
      ...option,
      values: option.values.filter((_, index) => index !== valueIndex),
    }));
  };

  return (
    <Stack spacing={2}>
      {value.map((option, optionIndex) => (
        <Box
          key={`option-${optionIndex}`}
          sx={{
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Stack spacing={2}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <TextField
                label="規格名稱"
                value={option.name}
                onChange={(event) =>
                  updateOption(optionIndex, (current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                fullWidth
              />
              <IconButton
                color="error"
                onClick={() => removeOption(optionIndex)}
                aria-label="刪除規格"
              >
                <DeleteIcon />
              </IconButton>
            </Box>

            <Stack spacing={1.5}>
              {option.values.map((optionValue, valueIndex) => (
                <Box
                  key={`option-${optionIndex}-value-${valueIndex}`}
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) auto",
                    },
                    alignItems: "start",
                  }}
                >
                  <TextField
                    label="規格值"
                    value={optionValue.name}
                    onChange={(event) =>
                      updateOption(optionIndex, (current) => ({
                        ...current,
                        values: current.values.map((valueItem, currentValueIndex) =>
                          currentValueIndex === valueIndex
                            ? {
                                ...valueItem,
                                name: event.target.value,
                              }
                            : valueItem,
                        ),
                      }))
                    }
                    fullWidth
                  />
                  <TextField
                    label="加價"
                    type="number"
                    value={optionValue.priceOffset}
                    onChange={(event) =>
                      updateOption(optionIndex, (current) => ({
                        ...current,
                        values: current.values.map((valueItem, currentValueIndex) =>
                          currentValueIndex === valueIndex
                            ? {
                                ...valueItem,
                                priceOffset: Number(event.target.value || 0),
                              }
                            : valueItem,
                        ),
                      }))
                    }
                  />
                  <TextField
                    label="成本增加"
                    type="number"
                    value={optionValue.costOffset}
                    onChange={(event) =>
                      updateOption(optionIndex, (current) => ({
                        ...current,
                        values: current.values.map((valueItem, currentValueIndex) =>
                          currentValueIndex === valueIndex
                            ? {
                                ...valueItem,
                                costOffset: Number(event.target.value || 0),
                              }
                            : valueItem,
                        ),
                      }))
                    }
                  />
                  <IconButton
                    color="error"
                    onClick={() => removeValue(optionIndex, valueIndex)}
                    aria-label="刪除規格值"
                    sx={{ mt: { sm: 1 } }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
            </Stack>

            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                每個規格值可設定自己的加價與成本增加，例如 XL +60、成本 +20。
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => addValue(optionIndex)}
              >
                新增規格值
              </Button>
            </Box>
          </Stack>
        </Box>
      ))}

      <Box>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={addOption}>
          新增規格
        </Button>
      </Box>
    </Stack>
  );
}
