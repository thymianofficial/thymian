// A glob rule set whose pattern matches another rule set — must be a framed
// error (AC2: rule sets cannot contain rule sets), never nested-loaded.
export default {
  name: 'glob-nested-outer',
  pattern: 'inner-set.mjs',
};
