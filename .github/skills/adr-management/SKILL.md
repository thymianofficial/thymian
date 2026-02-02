---
name: adr-management
description: Manage Architecture Decision Records (ADRs) for Thymian. Use this skill when asked to create, update, accept, deprecate, or supersede ADRs, document architectural decisions, or maintain the ADR index. Triggers include "create ADR", "new architectural decision", "update ADR status", "accept ADR", "deprecate ADR", "supersede ADR".
---

# ADR Management Skill

This skill helps manage Architecture Decision Records (ADRs) for the Thymian project following the [Michael Nygard template](https://github.com/joelparkerhenderson/architecture-decision-record/tree/main/locales/en/templates/decision-record-template-by-michael-nygard).

## File Locations

- **ADR files**: `docs/arc42/adr/NNNN-short-title.md`
- **ADR template**: `docs/arc42/adr/ADR-TEMPLATE.md`
- **ADR index**: `docs/arc42/09-architectural-decisions.md`
- **Quality requirements**: `docs/arc42/10-quality-requirements.md`

## ADR Numbering

Use 4-digit zero-padded numbers (e.g., `0001`, `0002`, `0015`). To find the next number, check the ADR index in `docs/arc42/09-architectural-decisions.md` and increment the highest existing number.

## Status Values

- **Proposed**: Under discussion, not yet accepted
- **Accepted**: Decision has been made and is in effect
- **Deprecated**: No longer recommended, but not replaced
- **Superseded**: Replaced by another ADR (must link to successor)

## Operations

### Creating a New ADR

1. Determine the next ADR number by checking the index in `docs/arc42/09-architectural-decisions.md`
2. Copy `docs/arc42/adr/ADR-TEMPLATE.md` to `docs/arc42/adr/NNNN-short-title.md`
3. Fill in all sections:
   - Update the title: `# ADR-NNNN: [Title]`
   - Set Status to `Proposed` and Date to today's date (YYYY-MM-DD)
   - Write Context, Decision, and Consequences sections
   - Add Related section with links to relevant quality requirements (10.2.x)
4. Add an entry to the index table in `docs/arc42/09-architectural-decisions.md`
5. If the ADR relates to a quality requirement, update `docs/arc42/10-quality-requirements.md` to add a back-reference in the "Related ADRs" column

### Accepting an ADR

1. Change Status from `Proposed` to `Accepted`
2. Update the Date to today's date
3. Add entry to Status History table at the bottom
4. Update the status in `docs/arc42/09-architectural-decisions.md` index

### Deprecating an ADR

1. Change Status from `Accepted` to `Deprecated`
2. Update the Date to today's date
3. Add a note in Consequences explaining why it's deprecated
4. Add entry to Status History table
5. Update the status in `docs/arc42/09-architectural-decisions.md` index

### Superseding an ADR

1. Create the new ADR that supersedes the old one (see "Creating a New ADR")
2. In the **old** ADR:
   - Change Status to `Superseded`
   - Update the Date to today's date
   - Fill in the "Superseded by" column with link to new ADR: `[ADR-NNNN](NNNN-title.md)`
   - Add entry to Status History table
3. In the **new** ADR:
   - Fill in the "Supersedes" column with link to old ADR: `[ADR-NNNN](NNNN-title.md)`
   - Reference the old ADR in the Related section
4. Update both entries in `docs/arc42/09-architectural-decisions.md` index

## Cross-References (Bidirectional Linking)

ADRs must maintain bidirectional links with arc42 documentation:

### ADR → Quality Requirements

In the ADR's "Related" section, link to relevant quality scenarios:

```markdown
## Related

- [Quality Requirement 10.2.3](../10-quality-requirements.md#102-quality-scenarios): Modularity — Description
```

### Quality Requirements → ADR

In `docs/arc42/10-quality-requirements.md`, the "Related ADRs" column should link back:

```markdown
| ... | 10.2.3 | [ADR-0001](adr/0001-core-features-as-plugins.md) |
```

### ADR → Other Arc42 Chapters

Link to relevant constraints, context, or other chapters:

```markdown
- [Constraint](../02-constraints.md): Description
- [Context](../03-context-and-scope.md): Description
```

## Validation Checklist

When creating or updating an ADR, verify:

- [ ] ADR number is unique and sequential
- [ ] All sections are filled in (Context, Decision, Consequences)
- [ ] Status and Date are current
- [ ] Related section includes quality requirement links
- [ ] ADR is listed in `09-architectural-decisions.md` index
- [ ] Related quality requirements in `10-quality-requirements.md` link back to ADR
- [ ] For superseded ADRs: both old and new ADRs link to each other
- [ ] Status History table is updated (if applicable)
