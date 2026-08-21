// Fixture: the reported hang (#688). `./**/*` matches the file it is written in, so before the
// self-match skip this rule set loaded itself, recognised itself, and re-globbed forever.
// The two sibling rules are what the user actually meant by "everything beside me".
export default {
  name: 'self-with-siblings',
  pattern: './**/*',
};
