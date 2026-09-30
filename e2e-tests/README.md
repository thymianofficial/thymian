# E2E Tests

This library contains end-to-end tests for Thymian. The tests include:

- publishing a test release via Verdaccio,
- installing the test release and
- running core Thymian core functionality.

## Running E2E tests

Run `nx e2e e2e-tests` to execute the tests via [Vitest](https://vitest.dev/). It builds
every published package first, publishes them to a local Verdaccio registry with their
committed versions, and leaves the working tree untouched.
