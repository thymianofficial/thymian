import nx from '@nx/eslint-plugin';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';

const depConstraintsProduction = [
  // Dimension: scope
  // scope:cli can only access core and cli (package.json dependencies are runtime only)
  {
    sourceTag: 'scope:cli',
    onlyDependOnLibsWithTags: ['scope:core', 'scope:cli'],
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
    rules: {},
  },
];
