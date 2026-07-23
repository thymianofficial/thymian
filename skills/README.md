# Thymian Agent Skills

Reusable **[Agent Skills](https://skills.sh)** for working with [Thymian](https://thymian.dev)
in any project. These are self-contained, framework-agnostic skills you install into your own
repo so your coding agent (Claude Code, Cursor, Cline, Continue, …) knows how to diagnose and fix
Thymian findings on **your** API.

They carry no repository-specific knowledge — install them anywhere you run `thymian`.

## Available skills

| Skill                                                       | Use when                                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`thymian-sampler-check`](./thymian-sampler-check/SKILL.md) | Fixing `thymian sampler check` status-code / content-type failures (`Expected status code X, but received Y`) — samples & hooks under `.thymian/samples/`. |
| [`thymian-test`](./thymian-test/SKILL.md)                   | Resolving `thymian test` conformance findings (the `Summary:` error/warning/hint/info counts) — RFC-9110 & api-description-validation rules.               |

The two are siblings and cross-reference each other; installing both is recommended.

## Install

These skills are distributed as source (not via npm) and installed with the
[`skills`](https://www.npmjs.com/package/skills) CLI, which discovers `SKILL.md` files in a repo
and copies them into your agent's skills directory.

Install both skills from this repo:

```sh
npx skills add https://github.com/thymianofficial/thymian/tree/main/skills
```

Or install a single skill:

```sh
npx skills add https://github.com/thymianofficial/thymian/tree/main/skills/thymian-sampler-check
npx skills add https://github.com/thymianofficial/thymian/tree/main/skills/thymian-test
```

`npx skills add thymianofficial/thymian` also works, but it discovers every `SKILL.md` in the
repo (including repo-internal ones under `.github/skills/`); prefer the `tree/main/skills` paths
above to install only the public, reusable set.

## Layout

Flat layout — one directory per skill, each with a `SKILL.md`:

```
skills/
├── README.md
├── thymian-sampler-check/
│   └── SKILL.md
└── thymian-test/
    └── SKILL.md
```

Every `SKILL.md` has YAML frontmatter with a `name` and a `description` (the trigger text the
agent matches against), so the skill activates automatically when you're working on the relevant
Thymian command.
