/**
 * 規格快速輸入解析。
 *
 * 例如：
 * - "黑，白，藍" -> ["黑", "白", "藍"]
 * - "黑，白，藍/M，L" -> ["黑 M", "黑 L", "白 M", "白 L", "藍 M", "藍 L"]
 */

const OPTION_SEPARATOR = /[,，、\n]+/;

export function parseVariantLabels(input: string): string[] {
  const normalized = input.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!normalized) return [];

  const groups = normalized
    .split("/")
    .map((group) =>
      group
        .split(OPTION_SEPARATOR)
        .map((value) => value.trim())
        .filter(Boolean),
    )
    .filter((group) => group.length > 0);

  if (groups.length === 0) return [];

  const labels = groups.reduce<string[]>(
    (acc, group) =>
      acc.flatMap((prefix) =>
        group.map((value) => (prefix ? `${prefix} ${value}` : value)),
      ),
    [""],
  );

  return [...new Set(labels)];
}
