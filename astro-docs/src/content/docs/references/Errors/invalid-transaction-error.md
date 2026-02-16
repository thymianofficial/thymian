---
title: 'InvalidTransactionError'
---

## The Cause

You selected a transaction to generate a hook for, but the transaction ID provided is invalid or the transaction does not exist in the format.

This can happen when:

- You provided an incorrect transaction ID
- The transaction was removed or modified
- The format has been reloaded since you obtained the transaction ID

## The Solution

To fix this:

1. List all available transactions to find the correct ID
2. Use the correct transaction ID when generating the hook
3. Ensure the format is up to date before selecting a transaction
