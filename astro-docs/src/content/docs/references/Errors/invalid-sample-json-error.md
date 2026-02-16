---
title: 'InvalidSampleJSONError'
---

## The Cause

A sample file contains invalid JSON and cannot be parsed. Sample files must be valid JSON documents.

This can happen when:

- The file was manually edited and contains syntax errors
- The file was corrupted
- The file was partially written due to an interrupted generation

Common JSON syntax errors:

```jsonc
// ❌ Trailing comma
{
  "foo": "bar",
}

// ❌ Single quotes instead of double quotes
{
  'foo': 'bar'
}

// ❌ Unquoted keys
{
  foo: "bar"
}

// ✅ Valid JSON
{
  "foo": "bar"
}
```

## The Solution

To fix this:

1. Validate the JSON file using a JSON validator
2. Fix any syntax errors
3. Or regenerate the samples:

```bash
thymian sampler:init --overwrite
```
