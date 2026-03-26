---
title: 'RepositoryNotInitializedError'
---

## The Cause

You attempted to run analytics linting, but the HTTP transaction repository was not initialized. The repository is required to store and query HTTP transactions for analytics-based linting rules.

This error typically occurs when:

- Analytics linting is triggered before the repository has been set up
- There's a configuration issue preventing repository initialization
- The `@thymian/http-analyzer` plugin is not registered.

## The Solution

Ensure that the `@thymian/http-analyzer` plugin is properly configured and registered before running analytics linting operations:

```yaml
plugins:
  '@thymian/http-analyzer':
    options:
      analytics:
        captureTransactions:
          type: in-memory
```
