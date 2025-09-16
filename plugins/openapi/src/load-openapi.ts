import { join } from 'node:path';

import { dereference, load, upgrade, validate } from '@scalar/openapi-parser';
import { fetchUrls } from '@scalar/openapi-parser/plugins/fetch-urls';
import { readFiles } from '@scalar/openapi-parser/plugins/read-files';
import { type Logger, type ThymianFormat } from '@thymian/core';
import type { OpenAPI } from 'openapi-types';

import { OpenApiError } from './error.js';
import { locMapperForFile } from './loc-mapper/loc-mapper-for-file.js';
import type { ServerInfo } from './processors/extract-server-info.js';
import { OpenapiProcessor } from './processors/openapi.processor.js';

export type ParseOpenApiOptions = {
  serverInfo: ServerInfo;
  allowExternalFiles: boolean;
  fetchExternalRefs: boolean;
  validateUpgrade?: boolean;
  filePath: string;
};

// There are a lot of problems with the @scalar/openapi-parser package. We should investigate further
export async function loadOpenapi(
  logger: Logger,
  options: ParseOpenApiOptions
): Promise<[ThymianFormat, OpenAPI.Document]> {
  const plugins = [];

  if (options.allowExternalFiles) {
    plugins.push(readFiles());
  }

  if (options.fetchExternalRefs) {
    plugins.push(fetchUrls());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any;
  let document: OpenAPI.Document | undefined = undefined;

  try {
    current = (await load(options.filePath, { plugins, throwOnError: true }))
      .filesystem;
  } catch (cause) {
    throw new OpenApiError(
      `Cannot load OpenAPI document from path "${options.filePath}".`,
      {
        cause,
        suggestions: [
          `Does the file ${join(process.cwd(), options.filePath)} exist?`,
        ],
      }
    );
  }
  try {
    document = (await validate(current, { throwOnError: true }))
      .specification as OpenAPI.Document;
  } catch (cause) {
    throw new OpenApiError(
      `Invalid OpenAPI document from path "${options.filePath}".`,
      {
        cause,
      }
    );
  }

  try {
    current = upgrade(current).specification;
  } catch (cause) {
    throw new OpenApiError(
      `Cannot upgrade OpenAPI document from path "${options.filePath}".`,
      {
        cause,
      }
    );
  }

  try {
    current = (await dereference(current, { throwOnError: true })).schema;
  } catch (cause) {
    throw new OpenApiError(
      `Cannot dereference OpenAPI document from path "${options.filePath}".`,
      {
        cause,
        suggestions: [`Are all external references valid AND available?`],
      }
    );
  }

  if (options.validateUpgrade) {
    try {
      current = (await validate(current, { throwOnError: true })).schema;
    } catch (cause) {
      throw new OpenApiError(
        `Validation after upgrading failed for OpenAPI document from path "${options.filePath}"`,
        {
          cause,
          suggestions: [
            "This might be because some parts of the Swagger/OpenAPI document couldn't be migrated automatically. It's best to migrate to the next version manually.",
          ],
        }
      );
    }
  }

  const locMapper = await locMapperForFile(options.filePath);

  return [
    new OpenapiProcessor(logger, options.serverInfo, locMapper).process(
      current
    ),
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    document!,
  ];
}
