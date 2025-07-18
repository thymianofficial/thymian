import type { ThymianPluginInitHook } from '@thymian/cli-common';
import { confirm, runPrompts } from '@thymian/cli-common/prompts';

import formatValidatorPlugin from '../index.js';

const hook: ThymianPluginInitHook = async function () {
  return runPrompts(async () => {
    const include = await confirm({
      message: `Do you want to validate your API description format against your real API with plugin ${formatValidatorPlugin.name}?`,
    });

    return {
      pluginName: formatValidatorPlugin.name,
      configuration: {},
      include,
    };
  });
};

export default hook;
