// A glob rule set whose pattern matches a real rule and a .d.ts declaration
// file — the .d.ts match must be skipped (framed, AC3), and the real rule
// must still load.
export default {
  name: 'glob-skip-kinds',
  pattern: '*',
};
