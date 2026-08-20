// Fixture: the same glob branch with a pattern that deliberately sweeps up files that are not
// modules at all — a declaration file, a JSON file and a README. Every one of them plainly exists,
// so without the loadable-extension filter the whole rule set dies on `Cannot resolve rule source`
// naming a file the user never meant to load.
export default {
  name: 'pattern-all-ts',
  pattern: './globbed/**/*',
};
