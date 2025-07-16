export function equalsIgnoreCase(a: string, ...b: string[]): boolean {
  return b.some(
    (str) => a.localeCompare(str, undefined, { sensitivity: 'accent' }) === 0
  );
}
