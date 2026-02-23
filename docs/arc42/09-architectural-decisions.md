# 9. Architectural Decisions

This chapter documents the significant architectural decisions made for Thymian. Each decision is recorded as an Architecture Decision Record (ADR) following the [Michael Nygard template](https://github.com/joelparkerhenderson/architecture-decision-record/tree/main/locales/en/templates/decision-record-template-by-michael-nygard).

> **For Copilot/Agents:** Use the [ADR management skill](../../.github/skills/adr-management/SKILL.md) to create, update, or manage ADRs.

## ADR Index

| ADR                                                    | Title                              | Status   | Date       | Related Quality Requirements                                                                                           |
| ------------------------------------------------------ | ---------------------------------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| [ADR-0001](adr/0001-core-features-as-plugins.md)       | Core features are plugins          | Accepted | 2024-11-07 | [10.2.2](10-quality-requirements.md#102-quality-scenarios), [10.2.3](10-quality-requirements.md#102-quality-scenarios) |
| [ADR-0002](adr/0002-communication-as-plugin.md)        | Communication as a plugin          | Proposed | 2024-11-07 | [10.2.4](10-quality-requirements.md#102-quality-scenarios)                                                             |
| [ADR-0003](adr/0003-plugins-allow-streaming.md)        | Plugins should allow for streaming | Proposed | 2024-11-07 | [10.2.1](10-quality-requirements.md#102-quality-scenarios), [10.2.2](10-quality-requirements.md#102-quality-scenarios) |
| [ADR-0004](adr/0004-plugins-run-isolated.md)           | Plugins should run isolated        | Proposed | 2024-11-07 | [10.2.3](10-quality-requirements.md#102-quality-scenarios)                                                             |
| [ADR-0005](adr/0005-tags-over-source-version-bumps.md) | Use git tags for release versions  | Accepted | 2026-01-31 | —                                                                                                                      |

## Creating New ADRs

To create a new ADR:

1. Copy the [ADR template](adr/ADR-TEMPLATE.md)
2. Use the next available 4-digit number (e.g., `0005-short-title.md`)
3. Fill in all sections, including cross-references to relevant quality requirements
4. Add the new ADR to the index table above
5. Update [Chapter 10 (Quality Requirements)](10-quality-requirements.md) with a back-reference if applicable

### Status Values

- **Proposed**: Under discussion, not yet accepted
- **Accepted**: Decision has been made and is in effect
- **Deprecated**: No longer recommended, but not replaced
- **Superseded**: Replaced by another ADR (must link to successor)
