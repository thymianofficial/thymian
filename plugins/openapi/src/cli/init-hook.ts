import type {
  ThymianPluginInitHook,
  ThymianPluginInitResult,
} from '@thymian/cli-common';
import {
  confirm,
  input,
  runPrompts,
  select,
} from '@thymian/cli-common/prompts';
import { glob } from 'tinyglobby';

import { openApiPlugin, type OpenApiPluginOptions } from '../index.js';

const hook: ThymianPluginInitHook<OpenApiPluginOptions> = async function (
  opts
) {
  return runPrompts(async () => {
    const options: OpenApiPluginOptions = {
      filePath: 'openapi.yaml',
    };

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

    const matches = await glob(
      [
        'swagger.json',
        'swagger.yml',
        'swagger.yaml',
        'openapi.json',
        'openapi.yml',
        'openapi.yaml',
      ],
      {
        cwd: opts.cwd,
        deep: 5,
      }
    );

    if (matches.length > 0) {
      options.filePath = await select({
        message: 'Which Swagger/OpenAPI file should be processed?',
        choices: matches,
        default: 'openapi.yaml',
      });
    }

    const port = await input({
      message: 'On which port your server is running?',
      default: '8080',
      validate: (port) => Number.isInteger(+port),
    });
    options.port = +port;

    options.host = await input({
      message: 'On which host your server is running?',
      default: 'localhost',
    });

    options.protocol = await select({
      message: 'Which protocol does your host server is using?',
      choices: ['http', 'https'],
      default: 'http',
    });

    options.allowExternalFiles = await confirm({
      message:
        'Do you want that external files are resolved automatically? (default: true)',
      default: true,
    });

    options.fetchExternalRefs = await confirm({
      message:
        'Do you want that external files are fetched automatically?  (default: false)',
      default: false,
    });

    return result;
  });
};

export default hook;
