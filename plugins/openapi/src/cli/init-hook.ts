import * as fs from 'node:fs';
import { join } from 'node:path';
import * as readline from 'node:readline';

import type {
  ThymianPluginInitHook,
  ThymianPluginInitResult,
} from '@thymian/cli-common';
import { confirm, runPrompts, select } from '@thymian/cli-common/prompts';
import { glob } from 'tinyglobby';

import { openApiPlugin, type OpenApiPluginOptions } from '../index.js';

export async function searchForOpenApiFiles(cwd: string): Promise<string[]> {
  const found: string[] = [];

  const matches = await glob('**/*.{json,yaml,yml}', {
    cwd,
  });

  for (const match of matches) {
    const filePath = join(cwd, match);

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });

    const rl = readline.createInterface({
      input: fileStream,
    });

    for await (const line of rl) {
      if (
        /^\s*"?swagger"?\s*:\s*("?2\.0\.0"?)/i.test(line) ||
        /^\s*"?openapi"?\s*:\s*("?3\.[01]\.[01234]"?)/i.test(line)
      ) {
        found.push(match);
        break;
      }
    }
  }

  return found;
}

const hook: ThymianPluginInitHook<OpenApiPluginOptions> = async function (
  opts
) {
  if (opts.interactive) {
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

      const matches = await searchForOpenApiFiles(opts.cwd);

      if (matches.length > 0) {
        options.filePath = await select({
          message: 'Which Swagger/OpenAPI file should be processed?',
          choices: matches,
          default: 'openapi.yaml',
        });
      }
      return result;
    });
  } else {
    const matches = await searchForOpenApiFiles(opts.cwd);

    return {
      include: true,
      pluginName: openApiPlugin.name,
      configuration: {
        options: {
          filePath: matches[0] ?? 'openapi.yaml',
          port: 8080,
          host: 'localhost',
          protocol: 'http',
          allowExternalFiles: true,
        },
      },
    };
  }
};

export default hook;
