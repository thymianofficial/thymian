import nx from '@nx/eslint-plugin';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';

import thymianEslintRules from './tools/eslint-rules/index.js';

const depConstraintsProduction = [
  // Dimension: scope
  // scope:cli can only access core, cli, plugin, and rules (thymian CLI app aggregates plugins)
  {
    sourceTag: 'scope:cli',
    onlyDependOnLibsWithTags: [
      'scope:core',
      'scope:cli',
      'scope:plugin',
      'scope:rules',
    ],
  },
  // scope:core can only access scope:core
  {
    sourceTag: 'scope:core',
    onlyDependOnLibsWithTags: ['scope:core'],
  },
  // scope:plugin can access core, cli, and plugin
  {
    sourceTag: 'scope:plugin',
    onlyDependOnLibsWithTags: ['scope:core', 'scope:cli', 'scope:plugin'],
  },

  // Dimension: type
  // type:app can access everything
  {
    sourceTag: 'type:app',
    onlyDependOnLibsWithTags: ['*'],
  },
  // type:lib can access lib
  {
    sourceTag: 'type:lib',
    onlyDependOnLibsWithTags: ['type:lib'],
  },
  // type:testing can access lib and testing
  {
    sourceTag: 'type:lib-feature',
    onlyDependOnLibsWithTags: ['type:lib', 'type:lib-feature'],
  },
  // type:e2e can access everything
  {
    sourceTag: 'type:e2e',
    onlyDependOnLibsWithTags: ['*'],
  },
  // Dimension: npm visibility
  // npm:public can depend only on npm:public
  {
    sourceTag: 'npm:public',
    onlyDependOnLibsWithTags: ['npm:public'],
  },
  // npm:private can depend on anything
  {
    sourceTag: 'npm:private',
    onlyDependOnLibsWithTags: ['npm:public', 'npm:private'],
  },
];

const depConstraintsTestFiles = depConstraintsProduction.map((constraint) => {
  // Add type:testing to allowed tags
  return {
    ...constraint,
    onlyDependOnLibsWithTags: [
      ...constraint.onlyDependOnLibsWithTags,
      'type:testing',
    ],
  };
});

export default [
  {
    // A suppression comment (e.g. on a rule with no .tags() call) must not
    // outlive the warning it silences.
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  {
    plugins: {
      'simple-import-sort': eslintPluginSimpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      'node_modules',
      '**/.astro',
    ],
  },
  {
    // Nx's inferred lint target runs `eslint .` with cwd set to each
    // project's own root, so this must stay cwd-agnostic rather than
    // rooted at `packages/rules-*/...` (which only resolves from the repo
    // root). The rule itself only fires on an httpRule(...) chain, so a
    // same-named fixture with unrelated shape elsewhere is never a match.
    files: ['**/*.rule.ts'],
    plugins: {
      'thymian-internal': thymianEslintRules,
    },
    rules: {
      'thymian-internal/require-rule-tags': 'warn',
    },
  },
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(.base)?.config.[cm]?js$'],
          depConstraints: depConstraintsProduction,
        },
      ],
    },
  },
  {
    files: ['**/test/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(.base)?.config.[cm]?js$'],
          depConstraints: depConstraintsTestFiles,
          // The vi.mock('@thymian/core', ...) factory must dynamically
          // import this mock subpath (factories can't close over top-level
          // statically-imported bindings — vitest hoists vi.mock calls), while
          // the same test file also statically imports mockState/
          // resetMockState from it for use in beforeEach/afterEach. That
          // dynamic+static combination is exactly what this rule normally
          // flags as an accidental lazy-load; it's intentional here.
          checkDynamicDependenciesExceptions: [
            '@thymian/core-testing/mocks/thymian',
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {
      curly: ['error', 'all'],
    },
  },
];
