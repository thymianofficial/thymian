#!/usr/bin/env node

import path from 'node:path';

import { getPluginNames, oclif } from '@thymian/cli-common';

const dirname = import.meta.dirname;

oclif.settings.enableAutoTranspile = false;

const thymianPath = import.meta.url.includes('node_modules')
  ? path.join(dirname, 'node_modules', 'thymian')
  : path.join(dirname, '..');

const pluginsPath = import.meta.url.includes('node_modules')
  ? thymianPath
  : path.join(dirname, '..');

await oclif.execute({
  development: true,
  dir: import.meta.url,
  loadOptions: {
    pluginAdditions: {
      core: await getPluginNames(),
      path: pluginsPath,
    },
    root: thymianPath,
  },
});
