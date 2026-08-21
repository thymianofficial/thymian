// Fixture: a self-globbing rule set that is the ONLY file in its directory. The self-match is
// removed before the "matched files but kept none" accounting, so this yields no rules rather
// than dying on `none of which can be loaded as a rule` — a message naming a file that loads fine.
export default {
  name: 'self-alone',
  pattern: './**/*',
};
