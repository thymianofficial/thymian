import type {
  ThymianPluginInitHook,
  ThymianPluginInitResult,
} from '@thymian/common-cli';
import { checkbox, confirm, runPrompts } from '@thymian/common-cli/prompts';

import { openApiPlugin, type OpenApiPluginOptions } from '../index.js';
import { searchForOpenApiFiles } from '../search-for-openapi-files.js';

const hook: ThymianPluginInitHook<OpenApiPluginOptions> = async function (
  opts,
) {
  if (opts.interactive) {
    return runPrompts(async () => {
      const options = {
        descriptions: [] as { source: string }[],
      } satisfies OpenApiPluginOptions;

      const result: ThymianPluginInitResult<OpenApiPluginOptions> = {
        include: true,
        configuration: {
          options,
        },
        pluginName: openApiPlugin.name,
      };

      const shouldInclude = await confirm({
        message: `Do you want to include plugin ${openApiPlugin.name}?`,
      });

      if (!shouldInclude) {
        return {
          pluginName: openApiPlugin.name,
          configuration: {},
          include: false,
        };
      }

      const matches = await searchForOpenApiFiles(opts.cwd);

      if (matches.length > 0) {
        const choices = await checkbox({
          message: 'Which Swagger/OpenAPI file should be processed?',
          choices: matches.map((name) => ({ name, value: name })),
        });

        options.descriptions = choices.map((c) => ({ source: c }));
      }
      return result;
    });
  } else {
    const matches = await searchForOpenApiFiles(opts.cwd);

    const descriptions = matches.map((match) => ({
      source: match,
    }));

    return {
      include: true,
      pluginName: openApiPlugin.name,
      configuration: {
        options: {
          descriptions,
        },
      },
    };
  }
};

export default hook;
