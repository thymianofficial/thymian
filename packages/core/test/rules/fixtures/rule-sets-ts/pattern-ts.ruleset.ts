// Fixture: a `**/*.ts` pattern — the shape that makes the declaration-file filter mandatory rather
// than nice to have. It matches `globbed/types.d.ts`, which `resolveUserModule` declines by design,
// so without the filter the whole rule set fails on a file that plainly exists.
export default {
  name: 'pattern-ts-all-ts',
  pattern: './globbed/**/*.ts',
};
