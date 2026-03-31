import type { ThymianSpecSearchHook } from '@thymian/cli-common';

import { openApiPlugin } from '../index.js';
import { searchForOpenApiFiles } from '../search-for-openapi-files.js';

const hook: ThymianSpecSearchHook = async function (opts) {
  const files = await searchForOpenApiFiles(opts.cwd);

  return {
    pluginName: openApiPlugin.name,
    specifications: files.map((file) => ({ type: 'openapi', location: file })),
  };
};

export default hook;
