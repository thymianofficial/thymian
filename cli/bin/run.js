#!/usr/bin/env node

import { getPluginNames, oclif } from '@thymian/cli-common';

await oclif.execute({
  dir: import.meta.url,
  loadOptions: {
    pluginAdditions: {
      core: await getPluginNames(),
      path: process.cwd(),
    },
    root: import.meta.url,
  },
});
