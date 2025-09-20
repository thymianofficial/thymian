# Contributing to Thymian

## Commit Message Scopes

When making commits, use one of the following scopes to indicate the area of the codebase your change affects:

| Scope              | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| cli                | Command-line interface and related commands                       |
| core               | Core framework logic, plugin system, and main APIs                |
| libs               | Shared libraries (umbrella scope for all libraries)               |
| plugins            | Official plugins extending Thymian functionality                  |
| shared             | Shared utilities and test resources                               |
| cli-common         | Library for CLI shared logic/utilities                            |
| http-filter        | Library for HTTP filtering logic                                  |
| http-status-codes  | Library for HTTP status code definitions/utilities                |
| http-testing       | Library for HTTP testing utilities                                |
| rfc-9110-rules     | Library for reusable HTTP rules based on RFC 9110                 |
| cli-reporter       | Plugin for CLI reporting features                                 |
| format-validator   | Plugin for format validation                                      |
| http-linter        | Plugin for HTTP linting                                           |
| openapi            | Plugin for OpenAPI support                                        |
| request-dispatcher | Plugin or library for request dispatching                         |
| sampler            | Plugin or library for sampling logic                              |
| test-utils         | Shared test utilities                                             |
| repo               | Changes affecting repository-wide configuration, tooling, or docs |

Use these scopes in your commit messages for clarity and traceability.

Example commit message:

```
feat(core): add new event bus for plugin registration
```

Refer to this list when contributing to ensure consistent commit messages.
