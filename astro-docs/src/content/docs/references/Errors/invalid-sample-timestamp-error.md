---
title: 'InvalidSampleTimestampError'
---

The timestamp in the samples metadata is invalid or cannot be parsed as a valid date. This usually indicates corruption in the samples metadata file.

The samples metadata includes a timestamp that tracks when the samples were generated. This timestamp must be a valid ISO 8601 date string.

To fix this, regenerate your samples:

```bash
thymian sampler:init --overwrite
```

This will create fresh samples with a valid timestamp.
