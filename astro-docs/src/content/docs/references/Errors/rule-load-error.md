---
title: 'RuleLoadError'
---

A rule module was loaded but does not export its rule using a default export. Thymian rules and rule sets must be exported using `export default` (ES modules) or `module.exports =` (CommonJS).

For example, if you have a rule file `my-rule.ts`:

```typescript
// ❌ Incorrect - named export
export const myRule = {
  /* rule definition */
};

// ✅ Correct - default export
export default {
  /* rule definition */
};
```

Make sure your rule file exports the rule or rule set as the default export.
