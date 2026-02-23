# ADR-0005: Use git tags for release versions

| Status   | Date       | Supersedes | Superseded by |
| -------- | ---------- | ---------- | ------------- |
| Accepted | 2026-01-31 | —          | —             |

## Context

Thymian is a monorepo with multiple published packages. The release process uses Nx Release to calculate versions from conventional commits and publish to npm, including canary releases. Committing version bumps in each package.json would create noisy release commits and frequent merge conflicts.

## Decision

We will not commit version bumps to source control. Release versions will be recorded via git tags and the npm registry. Package.json files will keep a placeholder version (e.g., 0.0.0-PLACEHOLDER) to make it clear the source version is not authoritative.

## Consequences

**Positive:**

- Git history remains clean and focused on functional changes.
- No recurring merge conflicts in package.json files across packages.
- Canary releases do not pollute history with temporary versions.

**Negative:**

- Developers must rely on git tags or npm registry to determine the current released version.
- Local package.json does not reflect the published version.

**Neutral:**

- Release automation must continue to handle tagging and publishing consistently.

## Related

- [Chapter 04](../04-solution-strategy.md): Solution strategy

---

## Status History

| Date       | Status   | Notes                         |
| ---------- | -------- | ----------------------------- |
| 2026-01-31 | Proposed | Initial draft                 |
| 2026-01-31 | Accepted | Approved after team agreement |
