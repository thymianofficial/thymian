// Fixture: a pattern that matches files and keeps none of them. Every match in `nonmodules/` is a
// declaration or a data file, so the loadable filter drops the lot — the case that must fail loudly
// instead of returning zero rules and passing.
export default {
  name: 'pattern-none-ts',
  pattern: './nonmodules/**/*',
};
