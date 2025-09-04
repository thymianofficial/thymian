import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { openapi } from '@scalar/openapi-parser';
import { fetchUrls } from '@scalar/openapi-parser/plugins/fetch-urls';
import { readFiles } from '@scalar/openapi-parser/plugins/read-files';
import { type Logger, type ThymianFormat } from '@thymian/core';

import { OpenApiError } from './error.js';
import { LocMapper } from './loc-mapper/loc-mapper.js';
import { locMapperForFile } from './loc-mapper/loc-mapper-for-file.js';
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
): Promise<[ThymianFormat, Record<PropertyKey, unknown>]> {
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

    const locMapper = await locMapperForFile(options.filePath);

    return [
      new OpenapiProcessor(logger, options, locMapper).process(schema),
      schema,
    ];
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
