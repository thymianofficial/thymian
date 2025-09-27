import type {
  ThymianPluginInitHook,
  ThymianPluginInitResult,
} from '@thymian/cli-common';
import { confirm, runPrompts } from '@thymian/cli-common/prompts';

import { httpLinterPlugin, type HttpLinterPluginOptions } from '../index.js';

const defaultRuleSets = ['@thymian/rfc-9110-rules'];

const hook: ThymianPluginInitHook<HttpLinterPluginOptions> = async function (
  options,
) {
  if (!options.interactive) {
    return {
      include: true,
      pluginName: httpLinterPlugin.name,
      configuration: {
        options: {
          rules: ['@thymian/rfc-9110-rules'],
        },
      },
    };
  }

  return runPrompts(async () => {
    const opts: HttpLinterPluginOptions = {
      ruleOptions: {},
      rules: [],
    };

    const result: ThymianPluginInitResult<HttpLinterPluginOptions> = {
      include: true,
      configuration: {
        options: opts,
      },
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

    const includeDefaultSets = await confirm({
      message: `Do you want to include default rule sets: ${defaultRuleSets.join(
        ', ',
      )}?`,
      default: true,
    });

    if (includeDefaultSets) {
      opts.rules.push(...defaultRuleSets);
    }

    return result;
  });
};

export default hook;
