import nx from '@nx/eslint-plugin';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';

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
          depConstraints: [
            // Core can depend only on core
            {
              sourceTag: 'core',
              onlyDependOnLibsWithTags: ['core', 'lib', 'shared'],
            },
            // Plugins can depend on core, plugin, and lib
            {
              sourceTag: 'plugin',
              onlyDependOnLibsWithTags: ['plugin', 'core', 'lib', 'shared'],
            },
            // Libs can depend on core, lib
            {
              sourceTag: 'lib',
              onlyDependOnLibsWithTags: ['core', 'lib', 'shared'],
            },
            // Shared utilities can depend on core, lib, shared
            {
              sourceTag: 'shared',
              onlyDependOnLibsWithTags: ['shared', 'core'],
            },
            // Apps (if any) can depend on anything except private
            {
              sourceTag: 'app',
              onlyDependOnLibsWithTags: ['*'],
            },
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
    rules: {},
  },
];
