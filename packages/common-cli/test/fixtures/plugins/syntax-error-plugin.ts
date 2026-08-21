// Fixture: deliberately unparseable TypeScript, so loading it fails with a genuine
// jiti/Babel parse error. Excluded from ESLint (eslint.config.mjs) because an unparseable file
// cannot carry a working eslint-disable comment.
export default {
  name: 'syntax-error-plugin'
  version: '1.0.0',
  plugin: async () => undefined,
};
