import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";

export interface ProductCreateActionsProps {
  formId: string;
  isSubmitting: boolean;
  onCancel: () => void;
}

export function ProductCreateActions({
  formId,
  isSubmitting,
  onCancel,
}: ProductCreateActionsProps): React.ReactElement {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ width: "100%", justifyContent: "flex-end" }}
    >
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={onCancel}>
          取消
        </Button>
        <Button
          type="submit"
          form={formId}
          variant="contained"
          disabled={isSubmitting}
          startIcon={
            isSubmitting ? (
              <CircularProgress size={16} color="inherit" />
            ) : undefined
          }
        >
          建立
        </Button>
      </Stack>
    </Stack>
  );
}
