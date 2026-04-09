---
title: 'PathAlreadyExistsError'
---

## The Cause

A file or directory already exists at the target path, and the operation is configured to fail when this happens. You're running in "failIfExist" mode.

## The Solution

To resolve this, you have two options:

1. **Remove the existing files/directories** (if you want to start fresh):

```bash
rm -rf path/to/samples
```

2. **Use overwrite mode** when initializing:

```bash
thymian sampler init --overwrite
```

The `--overwrite` flag tells Thymian to replace existing files instead of failing when they already exist. Use this when you want to regenerate samples and replace the old ones.
