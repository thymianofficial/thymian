---
title: 'How To Use Rules'
description: 'Integrating and configuring HTTP linting rules in your projects'
---

Once you've created HTTP rules, you need to integrate them into your API projects. This guide covers loading rules, configuration, and common usage patterns.

## Loading Rules

There are three ways to load rules into Thymian:

### 1. Via Configuration File

Create a `thymian.config.ts` file in your project root:

```typescript
import { defineConfig } from '@thymian/core';
import httpLinterPlugin from '@thymian/http-linter';

export default defineConfig({
  plugins: [
    {
      plugin: httpLinterPlugin,
      options: {
        rules: [
          './rules/**/*.rule.ts', // Local rules
          '@thymian/rfc-9110-rules', // Npm package
        ],
        modes: ['static', 'test'], // Which contexts to run
        ruleFilter: {
          severity: 'error', // Only errors
        },
      },
    },
  ],
});
```

### 2. Via CLI Flag

Pass rules directly on the command line:

```bash
thymian run --rules ./rules/**/*.rule.ts
```

For multiple rule sources:

```bash
thymian run \
  --rules ./rules/**/*.rule.ts \
  --rules @thymian/rfc-9110-rules
```

### 3. Programmatically

Load rules in your application code:

```typescript
import { Thymian } from '@thymian/core';
import httpLinterPlugin from '@thymian/http-linter';

const thymian = new Thymian({
  plugins: [
    {
      plugin: httpLinterPlugin,
      options: {
        rules: ['./rules/**/*.rule.ts'],
        modes: ['static'],
      },
    },
  ],
});

await thymian.run();
```

## Configuration Options

### Plugin Options

The HTTP linter plugin accepts these configuration options:

```typescript
{
  // Required: Rule sources (paths or package names)
  rules: string[];

  // Optional: Which contexts to run
  modes?: ('static' | 'test')[];

  // Optional: Filter which rules to run
  ruleFilter?: {
    severity?: 'error' | 'warn' | 'hint';
    appliesTo?: ('client' | 'server' | 'proxy')[];
    names?: string[];
  };

  // Optional: Rule-specific configuration
  ruleOptions?: Record<string, Record<string, unknown>>;
}
```

### Mode Configuration

Control which validation contexts run:

```typescript
{
  modes: ['static']; // Only static validation
}

{
  modes: ['static', 'test']; // Both static and test
}

{
  modes: ['test']; // Only test validation
}
```

If not specified, defaults to `['static']`.

### Rule Filtering

Filter which rules execute:

**By severity:**

```typescript
{
  ruleFilter: {
    severity: 'error'; // Only run error-level rules
  }
}
```

**By participant:**

```typescript
{
  ruleFilter: {
    appliesTo: ['server']; // Only server-side rules
  }
}
```

**By name:**

```typescript
{
  ruleFilter: {
    names: ['require-api-version-header', 'require-correlation-id'];
  }
}
```

**Combined:**

```typescript
{
  ruleFilter: {
    severity: 'error',
    appliesTo: ['server', 'proxy'],
    names: ['post-*', 'delete-*']  // Supports wildcards
  }
}
```

### Rule Options

Some rules accept configuration. Pass options via `ruleOptions`:

```typescript
{
  rules: ['./rules/**/*.rule.ts'],
  ruleOptions: {
    'require-api-version-header': {
      allowedVersions: ['v1', 'v2', 'v3']
    }
  }
}
```

## Using Rule Sets

### Installing Published Rule Sets

Rule sets can be published as npm packages:

```bash
npm install @thymian/rfc-9110-rules
```

Then reference them in your configuration:

```typescript
{
  rules: [
    '@thymian/rfc-9110-rules', // Npm package
    './custom-rules/**/*.rule.ts', // Plus local rules
  ];
}
```

### Example: RFC 9110 Rules

The `@thymian/rfc-9110-rules` package provides HTTP specification compliance rules:

```bash
npm install @thymian/rfc-9110-rules
```

```typescript
import rfc9110Rules from '@thymian/rfc-9110-rules';

export default defineConfig({
  plugins: [
    {
      plugin: httpLinterPlugin,
      options: {
        rules: [rfc9110Rules],
        modes: ['static', 'test'],
      },
    },
  ],
});
```

## Creating Your Own Rule Set

### File Structure

Organize your rule set as an npm package:

```
my-api-rules/
├── package.json
├── src/
│   ├── index.ts
│   └── rules/
│       ├── authentication/
│       │   └── require-bearer-token.rule.ts
│       ├── headers/
│       │   └── require-correlation-id.rule.ts
│       └── versioning/
│           └── check-api-version.rule.ts
└── tsconfig.json
```

### Package Definition

**package.json:**

```json
{
  "name": "@mycompany/api-rules",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "peerDependencies": {
    "@thymian/http-linter": "^0.0.1",
    "@thymian/core": "^0.0.1"
  }
}
```

### Rule Set Entry Point

**src/index.ts:**

```typescript
import type { RuleSet } from '@thymian/http-linter';

const myCompanyRules: RuleSet = {
  name: '@mycompany/api-rules',
  url: 'https://api-guidelines.mycompany.com',
  pattern: 'rules/**/*.rule.js', // Glob pattern for built rules
};

export default myCompanyRules;
```

### Publishing

```bash
npm run build
npm publish
```

### Using Your Rule Set

```bash
npm install @mycompany/api-rules
```

```typescript
import myCompanyRules from '@mycompany/api-rules';

export default defineConfig({
  plugins: [
    {
      plugin: httpLinterPlugin,
      options: {
        rules: [myCompanyRules],
      },
    },
  ],
});
```

## Common Integration Patterns

### Pattern 1: Local Development

For rapid iteration during development:

```typescript
export default defineConfig({
  plugins: [
    {
      plugin: httpLinterPlugin,
      options: {
        rules: ['./rules/**/*.rule.ts'],
        modes: ['static'], // Fast feedback
        ruleFilter: {
          severity: 'error', // Only errors
        },
      },
    },
  ],
});
```

### Pattern 2: CI/CD Pipeline

For comprehensive testing in CI:

```typescript
export default defineConfig({
  plugins: [
    {
      plugin: httpLinterPlugin,
      options: {
        rules: ['@thymian/rfc-9110-rules', '@mycompany/api-rules', './rules/**/*.rule.ts'],
        modes: ['static', 'test'], // Full validation
      },
    },
  ],
});
```

### Pattern 3: Production Monitoring

For analyzing production traffic:

```typescript
export default defineConfig({
  plugins: [
    {
      plugin: httpLinterPlugin,
      options: {
        rules: ['@mycompany/api-rules'],
        modes: ['analytics'], // Only analytics
        ruleFilter: {
          severity: 'error', // Critical issues only
        },
      },
    },
  ],
});
```

### Pattern 4: Progressive Enforcement

Start with warnings, gradually increase to errors:

```typescript
// Month 1: All warnings
{
  rules: ['@mycompany/api-rules'],
  ruleOptions: {
    '*': { severity: 'warn' }  // Override all to warnings
  }
}

// Month 2: Some errors
{
  rules: ['@mycompany/api-rules'],
  ruleFilter: {
    names: ['critical-*']  // Only critical rules
  }
}

// Month 3: All errors
{
  rules: ['@mycompany/api-rules']
  // Use default severities
}
```

## Working with Multiple Projects

### Shared Configuration

Create a shared configuration package:

```typescript
// @mycompany/thymian-config/index.ts
export const baseConfig = {
  plugins: [
    {
      plugin: '@thymian/http-linter',
      options: {
        rules: ['@mycompany/api-rules'],
        modes: ['static', 'test'],
      },
    },
  ],
};
```

Use in projects:

```typescript
import { defineConfig } from '@thymian/core';
import { baseConfig } from '@mycompany/thymian-config';

export default defineConfig({
  ...baseConfig,
  // Project-specific overrides
});
```

### Monorepo Setup

For monorepos, use workspace-relative paths:

```typescript
export default defineConfig({
  plugins: [
    {
      plugin: httpLinterPlugin,
      options: {
        rules: [
          '../../shared-rules/**/*.rule.ts', // Shared rules
          './rules/**/*.rule.ts', // Project-specific rules
        ],
      },
    },
  ],
});
```

## Debugging Rule Loading

### List Loaded Rules

See which rules are loaded:

```bash
thymian http-linter:list
```

Or with specific rule sources:

```bash
thymian http-linter:list --rules ./rules/**/*.rule.ts
```

### Search for Rules

Find rules by description:

```bash
thymian http-linter:search --for "authentication"
```

### Show Rule Statistics

View an overview of loaded rules:

```bash
thymian http-linter:overview
```

Output:

```
┌──────────────┬───────┬──────┬───────┐
│              │ error │ warn │ hint  │
├──────────────┼───────┼──────┼───────┤
│ static       │ 45    │ 23   │ 5     │
│ test         │ 12    │ 8    │ 2     │
│ analytics    │ 38    │ 19   │ 3     │
│ informational│ 15    │ 0    │ 0     │
└──────────────┴───────┴──────┴───────┘
138 rules loaded in total.
```

## Troubleshooting

### Rules Not Loading

**Problem:** Rules aren't being loaded

**Solutions:**

1. Check the glob pattern matches your files:

```bash
ls -la ./rules/**/*.rule.ts
```

2. Verify the rule exports default:

```typescript
export default httpRule('...'); // ✅ Correct
export const myRule = httpRule('...'); // ❌ Wrong
```

3. Check for TypeScript compilation errors:

```bash
tsc --noEmit
```

### Performance Issues

**Problem:** Linting is slow

**Solutions:**

1. Use static mode during development:

```typescript
{
  modes: ['static'];
} // Fast
```

2. Filter rules by severity:

```typescript
{
  ruleFilter: {
    severity: 'error'; // Only critical rules
  }
}
```

3. Run tests selectively in CI:

```typescript
{
  modes: ['static'],  // Fast local
  modes: ['static', 'test']  // Full in CI
}
```

### Rule Conflicts

**Problem:** Multiple rules report the same issue

**Solution:** Use rule names to disable duplicates:

```typescript
{
  ruleFilter: {
    names: [
      '!duplicate-rule-name', // Exclude this rule
      '*', // Include everything else
    ];
  }
}
```

## Next Steps

- Explore the [CLI commands](./cli.md) for managing rules
- Learn about [creating custom rules](./creating-new-rules.md)
- See [combining rule types](./combining-types.md) for hybrid validation
