---
title: 'TransactionSampleNotFoundError'
---

## The Cause

No sample could be found for the specified HTTP transaction. This means the transaction exists in your format, but there's no corresponding sample generated for it.

This can happen when:

- The samples are out of date and don't include this transaction
- The transaction was added to the format after samples were generated
- There was an error generating the sample for this specific transaction

## The Solution

To resolve this, regenerate your samples:

```bash
thymian sampler:init
```

This will create new samples for all transactions in your format, including the one that's currently missing.
