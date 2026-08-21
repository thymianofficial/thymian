// Fixture: half of an indirect rule-set cycle. Neither file matches itself, so the self-match
// skip cannot help here — only the ancestry chain terminates this.
export default {
  name: 'cycle-a',
  pattern: './b.ruleset.ts',
};
