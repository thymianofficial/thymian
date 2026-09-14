import {
  rule as requireRuleTags,
  RULE_NAME as requireRuleTagsName,
} from './rules/require-rule-tags.js';

// Named export (in addition to default) so Node's CJS/ESM interop exposes
// `rules` directly: @nx/eslint-plugin's workspace-rules auto-discovery
// (triggered just by this directory's conventional name/location, independent
// of our own explicit import in eslint.config.mjs) does `require()` on this
// module and destructures `{ rules }` from the result. With only a default
// export, that resolves to undefined and crashes on `Object.entries`.
export const rules = {
  [requireRuleTagsName]: requireRuleTags,
};

export default {
  rules,
};
