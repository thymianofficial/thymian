export function setContainsAll<T extends string | number>(
  set: Set<T>,
  toContain: T[],
): boolean {
  if (set.size !== toContain.length) return false;

  for (const value of toContain) {
    if (!set.has(value)) return false;
  }

  return true;
}
