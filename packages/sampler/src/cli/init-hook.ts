import type { ThymianPluginInitHook } from '@thymian/cli-common';
import { confirm, input, runPrompts } from '@thymian/cli-common/prompts';

import samplePlugin, { type SamplerPluginOptions } from '../index.js';

const hook: ThymianPluginInitHook<Partial<SamplerPluginOptions>> =
  async function (options) {
    if (!options.interactive) {
      return {
        include: false,
        pluginName: samplePlugin.name,
        configuration: {
          options: {},
        },
      };
    }

    return runPrompts(async () => {
      const options: Partial<SamplerPluginOptions> = {};

      const shouldInclude = await confirm({
        message: `Do you want to include plugin ${samplePlugin.name}?`,
      });

      const path = await input({
        message: 'At which path the samples should be generated?',
        required: false,
        default: '',
      });

      if (path) {
        options.path = path;
      }

      return {
        include: shouldInclude,
        pluginName: samplePlugin.name,
        configuration: {
          options,
        },
      };
    });
  };

export default hook;
