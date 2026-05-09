import Chip from "@mui/material/Chip";

export interface StatusChipProps {
  status: string;
  label?: string;
  colorMap: Record<
    string,
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning"
  >;
}

/**
 * 狀態標籤元件，依狀態值顯示不同顏色的 Chip。
 * 透過 colorMap 映射狀態字串到 MUI Chip 的 color prop。
 */
export function StatusChip({
  status,
  label,
  colorMap,
}: StatusChipProps): React.ReactElement {
  const color = colorMap[status] ?? "default";

  return <Chip label={label ?? status} color={color} size="small" />;
}
