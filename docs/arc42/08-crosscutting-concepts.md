# 8. Crosscutting Concepts

## 8.1 Events and Actions

TODO

## 8.2 Plugin implementation

TODO

## 8.3 Thymian format

TODO

## 8.4 Rules and Rulesets

TODO

## 8.5 Release and Versioning Process

Thymian follows a tag-based release process that maintains clean version control history without committing version bumps (see [ADR-0005](adr/0005-tags-over-source-version-bumps.md)).

### 8.5.1 Release Types

**Canary Releases:**

- Automatically triggered on every push to `main` branch
- Published to npm with dist-tag `canary`
- Version format: `{base-version}-canary.{YYYYMMDD}-{git-hash}`
- Non-interactive, immediate publishing
- Skipped when commit message contains `[skip-canary]`

**Latest Releases:**

- Manually triggered by developers using `--dist-tag latest`
- Interactive approval flow with local review
- Published to npm with dist-tag `latest`
- Two-phase process: local creation of tag/release, CI publishing to npm
- Requires GitHub environment approval and allowlist validation

### 8.5.2 Latest Release Workflow

**Local Phase (Developer):**

1. Run `node ./scripts/release.ts --dist-tag latest --no-local` (optionally add `--version X.Y.Z` to override conventional commits)
2. Script calculates next version using conventional commits (or uses explicit `--version` if provided)
3. Interactive prompt displays version and changelog
4. Developer approves or declines
5. If approved: Git tag and GitHub Release are created (no npm publish)
6. If declined: Exit gracefully, no changes made

**CI Phase (Automation):**

1. GitHub Release publication triggers workflow (`on.release.types: [published]`)
2. Workflow waits for GitHub environment approval (required reviewer)
3. Script validates:
   - `GITHUB_ACTOR` is in allowlist
   - Registry is not localhost
   - Version is exact semver (e.g., `1.2.3`)
4. Publishes packages to npm
5. No versioning or tagging occurs (already done locally)

### 8.5.3 Version Management

- **No version commits:** Package versions in `package.json` remain as placeholders in source control
- **Git tags as source of truth:** Releases are identified by git tags (format: `{version}`)
- **Conventional commits:** Automatic version calculation based on commit messages
- **Nx release:** Leverages Nx release tooling for versioning, changelog, and publishing

### 8.5.4 Security and Authorization

- **Allowlist:** Hardcoded list of GitHub usernames authorized to publish to `@latest`
- **Environment protection:** GitHub Environment (`npm`) can enforce required reviewer approval when configured in repository settings
- **Trusted publishing:** Uses OIDC token authentication for npm publishing

### 8.5.5 Key Configuration

- `nx.json`: Release configuration with `git.tag: true`, `changelog.createRelease: 'github'`, and `git.commit: false`
- `scripts/release.ts`: Release automation script with CI detection and interactive prompts
- `.github/workflows/release.yaml`: CI workflows for canary and latest releases

### 8.5.6 Related Documentation

- [ADR-0005: Tags over Source Version Bumps](adr/0005-tags-over-source-version-bumps.md)
