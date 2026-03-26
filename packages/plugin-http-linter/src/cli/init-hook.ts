import type {
  ThymianPluginInitHook,
  ThymianPluginInitResult,
} from '@thymian/cli-common';
import { confirm, runPrompts } from '@thymian/cli-common/prompts';

import { httpLinterPlugin, type HttpLinterPluginOptions } from '../index.js';

const hook: ThymianPluginInitHook<HttpLinterPluginOptions> = async function (
  options,
) {
  if (!options.interactive) {
    return {
      include: true,
      pluginName: httpLinterPlugin.name,
      configuration: {},
    };
  }

  return runPrompts(async () => {
    const result: ThymianPluginInitResult<HttpLinterPluginOptions> = {
      include: true,
      configuration: {},
      pluginName: httpLinterPlugin.name,
    };

    const shouldInclude = await confirm({
      message: `Do you want to include plugin ${httpLinterPlugin.name}?`,
    });

    if (!shouldInclude) {
      return {
        pluginName: httpLinterPlugin.name,
        configuration: {},
        include: false,
      };
    }

    return result;
  });
};

export default hook;
