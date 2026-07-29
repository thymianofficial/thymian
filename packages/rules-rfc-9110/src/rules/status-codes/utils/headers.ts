export function hasNonEmptyHeaderValue(
  value: string | string[] | undefined,
): boolean {
  const list = Array.isArray(value) ? value : value != null ? [value] : [];
  return list.some((v) => v.trim().length > 0);
}
