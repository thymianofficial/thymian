import { openapi } from '@scalar/openapi-parser';
import { fetchUrls } from '@scalar/openapi-parser/plugins/fetch-urls';
import { readFiles } from '@scalar/openapi-parser/plugins/read-files';
import { type Logger, ThymianError, type ThymianFormat } from '@thymian/core';

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
  opts: Partial<ParseOpenApiOptions>
): Promise<ThymianFormat> {
  const options = {
    filePath: 'openapi.yml',
    port: 8080,
    host: 'localhost',
    protocol: 'http',
    allowExternalFiles: true,
    fetchExternalRefs: false,
    ...opts,
  } satisfies ParseOpenApiOptions;

  console.log(options);

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
    console.log(e);
    throw new ThymianError(
      `Cannot process OpenAPI document from path "${options.filePath}".`,
      e
    );
  }
}
