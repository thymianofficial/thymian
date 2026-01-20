#!/usr/bin/env node

import path from 'node:path';

import { getPluginNames, oclif } from '@thymian/cli-common';

const thymianPath = import.meta.url.includes('node_modules')
  ? path.join(process.cwd(), 'node_modules', '@thymian', 'cli')
  : import.meta.url;

const pluginsPath = import.meta.url.includes('node_modules')
  ? thymianPath
  : process.cwd();

await oclif.execute({
  dir: thymianPath,
  loadOptions: {
    pluginAdditions: {
      core: await getPluginNames(),
      path: pluginsPath,
    },
    root: thymianPath,
  },
});
