---
title: 'HookImportError'
---

## The Cause

Failed to import a hook module. The hook file could not be loaded, or the imported module is not a function.

Common causes:

- The hook file doesn't exist at the specified path
- The hook is not exported as default
- The exported value is not a function
- Syntax errors in the hook file preventing it from loading

## The Solution

Hooks must be exported as default exports and must be functions:

```typescript
// ❌ Incorrect
export const myHook = () => {
  /* ... */
};

// ❌ Incorrect - not a function
export default { hook: () => {} };

// ✅ Correct
export default function myHook() {
  // Hook implementation
}
```

To fix this:

1. Verify the hook file exists
2. Ensure it exports a function as default
3. Check for syntax errors in the hook file
