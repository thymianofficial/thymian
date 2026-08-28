import type { ThymianPlugin } from '@thymian/core';

const plugin: ThymianPlugin = {
  plugin: async () => undefined,
  name: 'valid-ts-plugin',
  // `version` is a semver *range* of compatible @thymian/core versions, not
  // this plugin's own version — '*' matches any installed core version.
  version: '*',
};

export default plugin;
