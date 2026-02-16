---
title: 'SamplesNotLoadedError'
---

## The Cause

You attempted to retrieve the path for a transaction, but no samples have been loaded. The sampler needs to load samples from disk before it can provide file paths for transactions.

This typically happens when:

- The samples haven't been generated yet
- The samples directory is empty or doesn't exist
- There was an error loading the samples

## The Solution

To resolve this:

1. Generate samples if you haven't already:

```bash
thymian sampler:init
```

2. Ensure the samples directory exists and contains the generated sample files

3. Check that the samples are being loaded correctly before attempting to get transaction paths
