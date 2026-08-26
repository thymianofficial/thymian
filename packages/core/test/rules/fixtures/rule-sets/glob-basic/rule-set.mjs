// A glob rule set over ./rules/*.rule.mjs — used to assert deterministic
// sort order (AC5). The AC1 node_modules-exclusion case lives in a
// runtime-built tmpdir fixture instead (a real node_modules/ directory
// cannot be a committed fixture; the repo's own .gitignore excludes it).
export default {
  name: 'glob-basic',
  pattern: './rules/*.rule.mjs',
};
