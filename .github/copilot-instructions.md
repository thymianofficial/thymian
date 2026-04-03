# GitHub Copilot Instructions

These instructions guide GitHub Copilot when reviewing code and documentation in the Thymian repository.

## General Review Guidelines

### Workspace & Architecture

- This is an **Nx monorepo** — projects live under `packages/` and are configured via `project.json` and `nx.json`
- Follow the **plugin architecture** documented in [AGENTS.md](../AGENTS.md) — virtually everything in Thymian is a plugin
- Understand the **event-driven architecture** using `ThymianEmitter` for events, actions, and errors
- Packages are located under `packages/` — each package has its own `project.json`, `package.json`, and build configuration

### Package Versions — DO NOT MODIFY

- **`version` fields in `package.json` files use `0.0.0-PLACEHOLDER`** — this value is replaced automatically by the release pipeline at publish time
- **NEVER** change `version` or internal `@thymian/*` dependency versions in `package.json` files
- This applies to the `version` field itself **and** to any `dependencies`, `devDependencies`, or `peerDependencies` that reference `@thymian/*` packages
- If you see `0.0.0-PLACEHOLDER` in a `package.json`, leave it exactly as-is

### Code Quality

- **TypeScript**: Ensure strict mode compliance, proper typing (no implicit `any`), and consistent use of interfaces/types
- **Linting**: Code must pass ESLint rules defined in `eslint.config.mjs`
- **Testing**: Changes should include or update tests (Vitest) — check `*.spec.ts` and `test/` directories
- **Formatting**: Follow existing code style and formatting conventions

### Nx Conventions

- New libraries/packages should be created using Nx generators
- Respect project boundaries and dependency constraints
- Use proper tags and scope for new projects
- Build targets should be cacheable where possible

### Commit Messages

- Follow [Conventional Commits](https://www.conventionalcommits.org/) format
- Check `commitlint.config.js` for allowed types and scopes
- Include `[skip-canary]` in commit message to skip canary deployment when appropriate (see [AGENTS.md](../AGENTS.md))
- Verify relevant issue(s) are linked in the commit message footer using fully qualified references (e.g., `Fixes org/repo#123`) because issues may live in other Thymian-internal repos
- If more than one issue is linked in the commits of this PR, suggest splitting the PR so one PR addresses one issue

---

## Architecture Decision Records (ADRs)

### When to Create/Update ADRs

Flag for ADR creation or update when a PR includes:

- New architectural patterns or significant design changes
- New packages/plugins that introduce architectural concepts
- Changes to core framework (`packages/core/`)
- Modifications to the event system or plugin architecture
- Technology choices (new dependencies, frameworks, tools)
- Changes that affect multiple packages or cross-cutting concerns

### ADR Review Checklist

When reviewing ADRs or changes that should have ADRs:

1. **Existence**: Does an architectural change have a corresponding ADR?
2. **Status/Date Consistency**:
   - Is the status one of: `Proposed`, `Accepted`, `Deprecated`, `Superseded`?
   - Is the date updated when status changes?
3. **Content Completeness**:
   - Are Context, Decision, and Consequences sections filled in?
   - Are consequences categorized (Positive/Negative)?
4. **Cross-References (Bidirectional)**:
   - Does the ADR link to relevant quality requirements in `docs/arc42/10-quality-requirements.md`?
   - Does the quality requirements table link back to the ADR?
   - Is the ADR listed in the index at `docs/arc42/09-architectural-decisions.md`?
5. **Supersession**:
   - If an ADR supersedes another, do both ADRs link to each other?
   - Is the old ADR marked as `Superseded` with correct date?

### ADR Locations

- Individual ADRs: `docs/arc42/adr/NNNN-title.md`
- ADR Index: `docs/arc42/09-architectural-decisions.md`
- ADR Template: `docs/arc42/adr/ADR-TEMPLATE.md`
- Quality Requirements: `docs/arc42/10-quality-requirements.md`
- ADR Management Skill: `.github/skills/adr-management/SKILL.md`

---

## Arc42 Documentation Consistency

When reviewing changes to arc42 documentation (`docs/arc42/`):

1. **Quality Scenario IDs**: Verify referenced IDs (e.g., `10.2.3`) exist in the quality requirements table
2. **Cross-Chapter Links**: Ensure relative links between chapters are correct
3. **ADR Index**: When ADRs are added/modified, verify the index table is updated
4. **Bidirectional Links**: Quality requirements should link to related ADRs, and vice versa
5. **Mermaid Diagrams**: Validate syntax if diagrams are modified

---

## Plugin Development

When reviewing plugin code:

1. Plugins must implement the correct interfaces from `packages/core/`
2. Plugins should use the event system (`ThymianEmitter`) for communication
3. Plugin schema files should be co-located with the plugin
4. Configuration should be validated against the schema
5. Plugins should be properly registered and emit `core.register` events

---

## CLI Documentation (cli.md files)

When reviewing `cli.md` files in `astro-docs/src/content/docs/references/`:

1. **🔴 Required**: Content between `<!-- commands -->` and `<!-- commandsstop -->` markers must be empty
2. These markers indicate auto-generated content zones — manual content should never be committed
3. The correct format is:

   ```markdown
   # Commands

     <!-- commands -->
     <!-- commandsstop -->
   ```

4. Any content between these markers (command lists, usage examples, etc.) indicates the file was committed with auto-generated content and must be removed

---

## Review Response Format

When providing review feedback, categorize issues as:

- **🔴 Required**: Must be fixed before merge (bugs, security, architectural violations)
- **🟡 Suggested**: Should be considered (code quality, best practices)
- **🟢 Optional**: Nice to have (style preferences, minor improvements)
- **📝 ADR**: Architecture-related — needs ADR creation/update
