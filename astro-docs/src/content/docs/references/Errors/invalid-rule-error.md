---
title: 'InvalidRuleError'
---

## The Cause

A loaded rule declares one or more executable types (`static`, `analytics`, or `test`) but has no execution function for at least one of them. Such a rule would register but silently never run. This can happen when:

- a rule object is constructed by hand (without the `httpRule` builder) and misses the `lintRule`, `analyzeRule`, or `testRule` function for a declared type, or
- the `type` override for a rule in your Thymian config file points at a type the rule has no execution function for, or
- a rule combines the `informational` type with executable types — `informational` must be the only type of a rule, or
- a rule's `meta.type` is malformed: missing, not an array, empty, or containing unknown rule types.

## The Solution

Make sure every declared executable type has a matching execution function:

```typescript
import { httpRule } from '@thymian/core';

// ✅ .rule() provides the execution function for every declared type
export default httpRule('my-rule')
  .severity('warn')
  .type('static', 'analytics')
  .rule((context, options, logger) => {
    /* rule logic */
  })
  .done();
```

If the rule is documentation-only, declare it as `informational` instead — informational rules are the only rules without execution functions:

```typescript
export default httpRule('my-informational-rule')
  .severity('warn')
  .type('informational') // informational rules never execute
  .description('Documented requirement that cannot be checked automatically.')
  .done();
```

If the error points at a `type` override in your Thymian config file, restrict the override to types the rule actually implements, or set the rule's type to `['informational']` to stop executing it.

If the broken rule comes from a package you do not control, disable it by setting its severity to `off` in your Thymian config file — a disabled rule is filtered out before this validation runs — or downgrade it to `['informational']` via the `type` override.
