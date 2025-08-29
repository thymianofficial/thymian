import { join } from 'node:path';

import { openapi } from '@scalar/openapi-parser';
import { fetchUrls } from '@scalar/openapi-parser/plugins/fetch-urls';
import { readFiles } from '@scalar/openapi-parser/plugins/read-files';
import { type Logger, type ThymianFormat } from '@thymian/core';

import { OpenApiError } from './error.js';
import { OpenapiProcessor } from './processors/openapi.processor.js';

export type ParseOpenApiOptions = {
  filePath: string;
  port: number;
  host: string;
  protocol: 'http' | 'https';
  allowExternalFiles: boolean;
  fetchExternalRefs: boolean;
};

export async function loadOpenapi(
  logger: Logger,
  options: ParseOpenApiOptions
): Promise<ThymianFormat> {
  const plugins = [];

  if (options.allowExternalFiles) {
    plugins.push(readFiles());
  }

  if (options.fetchExternalRefs) {
    plugins.push(fetchUrls());
  }

  try {
    const { schema } = await openapi({ throwOnError: true })
      .load(options.filePath, { plugins })
      .upgrade()
      .validate()
      .get();

    return new OpenapiProcessor(logger, options).process(schema);
  } catch (e) {
    throw new OpenApiError(
      `Cannot process OpenAPI document from path "${options.filePath}".`,
      {
        cause: e,
        suggestions: [
          `Does the file ${join(process.cwd(), options.filePath)} exist?`,
        ],
      }
    );
  }
}
