// Fixture: the second half of a rule split across files. Imported once without an extension and
// once as `./helper.js` (the NodeNext spelling), which are the two shapes Node's loader cannot
// resolve to a `.ts` file on disk.
export const helperType = ['test', 'analytics'] as const;

export function helperName(suffix: string): string {
  return `split-${suffix}`;
}
