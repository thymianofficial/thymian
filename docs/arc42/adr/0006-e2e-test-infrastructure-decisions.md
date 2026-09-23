# ADR-0006: E2E test infrastructure decisions

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-03-31 | —          | —             |

## Context

Thymian's e2e test suite verifies the installed CLI tool against a local Verdaccio npm registry. Several infrastructure decisions were required to make the tests reliable both in CI and on developer machines. The key problems were:

1. **Host system contamination**: The original `npm install -g` polluted the developer's global `node_modules`, making e2e tests unsafe to run locally (only runnable in disposable CI environments).

2. **Output verification fragility**: `execSync()` captures stdout from the immediate child process, but nested NX commands write their output directly to the terminal (inherited stdio). This made output-based success checks unreliable — the "Successfully ran target" message appeared in the terminal but was absent from the captured buffer.

3. **cli-testing-library in global setup**: The `waitFor()` polling function from `cli-testing-library` was used in `global.setup.ts` to check synchronous `execSync` output — an unnecessary async wrapper around already-available data that could leave timers active in the event loop.

4. **Verdaccio process cleanup**: The Verdaccio child process started via `exec()` created an attached process group. On teardown, a simple `.kill()` could leave orphaned child processes holding port 4873.

5. **User config contamination** _(added 2026-09-23)_: npm env vars take precedence over `.npmrc`, so a process-wide `npm_config_registry` redirected every npm call the run forked, and the Verdaccio executor's writes to `~/.npmrc` and `~/.yarnrc` survived any run whose teardown killed it, leaving the developer's npm pointed at a dead registry.

## Decision

### Isolate global installs via `npm_config_prefix`

We will use `npm_config_prefix` to redirect `npm install -g` to a temporary directory instead of the system-wide global `node_modules`. This eliminates host contamination and makes e2e tests safe to run locally.

```typescript
const globalPrefix = mkdtempSync(join(tmpdir(), 'thymian-e2e-global-'));
execSync(`npm install -g thymian@${version}`, {
  env: { ...cleanEnv, npm_config_prefix: globalPrefix, npm_config_registry: verdaccioUrl },
});
// Binary at: join(globalPrefix, 'bin', 'thymian')
// Teardown: rmSync(globalPrefix, { recursive: true })
```

### Scope registry via environment variables, not `.npmrc`

_Amended 2026-09-23: registry scoped per call instead of process-wide, and Verdaccio no longer writes user config._

We will point npm at Verdaccio with the `npm_config_registry` environment variable instead of modifying `.npmrc` files or running `npm config set`. The variable is scoped **per call**: each npm or npx invocation that needs Verdaccio (local publish, the global install, the loader-harness installs, `npx` installation mode) gets it on that call alone: in its own `env` object, or as a `--registry` flag. It is never set on the global-setup process's own `process.env`, because npm env vars take precedence over `.npmrc`, and a process-wide assignment would redirect every npm invocation the run forks, not only the intended ones.

The registry URL reaches test files through `THYMIAN_E2E_REGISTRY`, set by the global setup alongside `THYMIAN_E2E_VERSION`, `THYMIAN_E2E_GLOBAL_BIN` and `THYMIAN_E2E_GLOBAL_PREFIX`, and deleted in teardown.

The `@nx/js:verdaccio` executor behind `npm run local-registry` by default writes the registry and an auth token into the developer's `~/.npmrc` and `~/.yarnrc`, restoring them only on a graceful exit that a killed run never reaches. The global setup therefore starts it with `--location none`, which turns those writes off, and gives the local-publish call (npm will not publish without a token, even to an open registry) a throwaway npmrc in the OS temp directory via `npm_config_userconfig`. The developer's user config is never written.

### Strip environment variables for child processes

We will use a `getCleanEnv()` helper that filters out `NX_*`, `NODE_PATH`, test runner worker IDs, and other variables that could leak from the monorepo workspace into test processes. This prevents workspace module resolution from silently resolving packages from the development `node_modules/` instead of from the installed CLI.

### Spawn Verdaccio detached with process group cleanup

We will start Verdaccio via `spawn()` with `{ detached: true, stdio: 'ignore' }` and `unref()` the handle. On teardown, we kill the entire process group via `process.kill(-pid, 'SIGKILL')` to ensure no orphaned child processes remain.

### Use `execSync` with `stdio: 'inherit'` for publish and install steps

We will use `execSync` with `stdio: 'inherit'` for the local-publish and npm-install steps, relying on the non-zero exit code (which causes `execSync` to throw) as the success signal. This avoids the fragile pattern of capturing output and checking for specific success strings, which fails when nested NX commands write to inherited stdio rather than the captured pipe.

### Remove cli-testing-library from global setup

We will not use `cli-testing-library` in `global.setup.ts`. The `waitFor()` function was wrapping synchronous checks unnecessarily. Verdaccio readiness is checked with a simple polling loop using `node:timers/promises` `setTimeout`. The library remains in use in the test file itself, where `render()` and `waitFor()` are genuinely needed for the interactive WebSocket/serve tests.

### Use OS temp directories outside the workspace tree

We will create per-test temp directories via `mkdtempSync(join(tmpdir(), 'thymian-e2e-'))` in the OS temp directory, not inside the workspace. This prevents Node's module resolution from walking up into the monorepo `node_modules/` and silently resolving workspace packages instead of the installed CLI's dependencies.

### Dynamic port allocation

We will use OS-assigned ports (binding to port 0 and reading the assigned port) for test servers (Fastify, WebSocket proxy) instead of hardcoded ports. This eliminates port conflicts and enables future parallel test execution.

## Consequences

**Positive:**

- E2e tests are safe to run on developer machines — no global install contamination.
- Verdaccio cleanup is reliable — no orphaned processes holding port 4873.
- Publish/install verification is robust — not dependent on output parsing.
- Test isolation is stronger — temp dirs outside workspace, clean env, scoped registry.

**Negative:**

- `stdio: 'inherit'` means publish/install output goes to the terminal but cannot be programmatically inspected for warnings.

**Neutral:**

- `cli-testing-library` remains a dependency for the test file (websocket/interactive tests) but is no longer used in the setup/teardown lifecycle.

## Related

- [Chapter 08](../08-crosscutting-concepts.md): Crosscutting concepts (testing)
- [Chapter 10](../10-quality-requirements.md): Quality requirements (reliability, testability)
- [Chapter 11](../11-risks-and-technical-debt.md): Risks and technical debt

---

## Status History

| Date       | Status   | Notes                                                                                      |
| ---------- | -------- | ------------------------------------------------------------------------------------------ |
| 2026-03-31 | Accepted | Initial draft                                                                              |
| 2026-09-23 | Amended  | Registry scoped per call instead of process-wide; Verdaccio started with `--location none` |
