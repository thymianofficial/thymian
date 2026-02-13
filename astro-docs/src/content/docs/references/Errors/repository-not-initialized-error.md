---
title: 'RepositoryNotInitializedError'
---

You attempted to run analytics linting, but the HTTP transaction repository was not initialized. The repository is required to store and query HTTP transactions for analytics-based linting rules.

This error typically occurs when:

- Analytics linting is triggered before the repository has been set up
- There's a configuration issue preventing repository initialization
- You have not set the `analytics` type in the `@thymian/http-linter` configuration.

```yaml
plugins:
  - '@thymian/http-linter':
      options:
        type:
          - analytics # <-- you have to set this in order to use the `http-linter.lint-analytics-batch` action
```

Ensure that the HTTP transaction repository is properly configured and initialized before running analytics linting operations.
