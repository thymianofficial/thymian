---
title: 'UnknownContentSourceTypeError'
---

## The Cause

An unknown content source type was encountered while transforming sample parameters. Content sources can be either inline content or file references.

This error typically indicates internal data corruption or a bug in how samples are being written or transformed.

## The Solution

If you encounter this error, try regenerating your samples:

```bash
thymian sampler:init
```

If the error persists, it may indicate a bug that should be reported.
