import type { ThymianPluginInitHook } from '@thymian/cli-common';
import { confirm, input, runPrompts } from '@thymian/cli-common/prompts';

import dispatcherPlugin, { type SamplerPluginOptions } from '../index.js';

const hook: ThymianPluginInitHook<SamplerPluginOptions> = async function (
  options,
) {
  if (!options.interactive) {
    return {
      include: false,
      pluginName: dispatcherPlugin.name,
      configuration: {
        options: {},
      },
    };
  }

  return runPrompts(async () => {
    const options: SamplerPluginOptions = {};

    const shouldInclude = await confirm({
      message: `Do you want to include plugin ${dispatcherPlugin.name}?`,
    });

    const concurrency = await input({
      message: 'With which concurrency requests should be dispatched?',
      required: false,
      default: '10',
    });

    if (concurrency) {
      options.concurrency = +concurrency;
    }

    return {
      include: shouldInclude,
      pluginName: dispatcherPlugin.name,
      configuration: {
        options,
      },
    };
  });
};

export default hook;
