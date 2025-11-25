#!/usr/bin/env node

import { getPluginNames, oclif } from '@thymian/cli-common';

await oclif.execute({
  development: true,
  dir: import.meta.url,
  loadOptions: {
    pluginAdditions: {
      core: await getPluginNames(),
      path: process.cwd(),
    },
    root: import.meta.url,
  },
});
