import { isAbsolute, join } from 'node:path';

import { bundle } from '@scalar/json-magic/bundle';
import {
  fetchUrls,
  parseJson,
  parseYaml,
  readFiles,
} from '@scalar/json-magic/bundle/plugins/node';
import { dereference, validate } from '@scalar/openapi-parser';
import { upgrade } from '@scalar/openapi-upgrader';
import {
  type HttpFilterExpression,
  type Logger,
  NoopLogger,
  ThymianBaseError,
  type ThymianFormat,
} from '@thymian/core';
import type { OpenAPI, OpenAPIV3_1 } from 'openapi-types';

import { locMapperForFile } from './loc-mapper/loc-mapper-for-file.js';
import { NoopLocMapper } from './loc-mapper/noop-loc-mapper.js';
import type { ServerInfo } from './processors/extract-server-info.js';
import { OpenapiProcessor } from './processors/openapi.processor.js';

export type LoadResult = {
  document: OpenAPIV3_1.Document;
  original: OpenAPI.Document;
  filePath?: string;
};

export async function loadOpenApi(
  value: string,
  cwd: string = process.cwd(),
): Promise<[object, string]> {
  const readFilesPlugin = readFiles();
  // the validate function of the readFiles plugin returns undefined if the value is not a local file
  const isFileValue = readFilesPlugin.validate(value);
  const finalValue =
    !isFileValue || (isFileValue && isAbsolute(value))
      ? value
      : join(cwd, value);

  const plugins = [parseJson(), parseYaml(), readFilesPlugin, fetchUrls()];

  return [
    await bundle(finalValue, {
      plugins,
      treeShake: false,
    }),
    finalValue,
  ];
}

export async function loadAndUpgrade(
  value: string,
  cwd: string = process.cwd(),
  logger: Logger,
): Promise<LoadResult> {
  try {
    const [result, filePath] = await loadOpenApi(value, cwd);

    logger.debug(`Loaded OpenAPI document.`);

    await validate(result, { throwOnError: true });

    logger.debug(`Successfully validated OpenAPI document.`);

    const upgradedObject = upgrade(structuredClone(result), '3.1');

    logger.debug(`Upgraded OpenAPI document.`);

    const dereferenced = dereference(upgradedObject, {
      throwOnError: true,
    }).schema as OpenAPIV3_1.Document;

    logger.debug(`Dereferenced OpenAPI document.`);

    return {
      document: dereferenced,
      original: result as OpenAPI.Document,
      filePath: filePath ? filePath : undefined,
    };
  } catch (e) {
    throw new ThymianBaseError(`Error while loading OpenAPI document.`, {
      cause: e,
      suggestions: [
        'Currently, only files without external references are supported. Do your OpenAPI documents contain any external references?',
        'You can validate your OpenAPI document using the `thymian openapi:validate` command.',
      ],
    });
  }
}

export async function openapiToThymianFormat(
  document: OpenAPIV3_1.Document,
  options: {
    logger?: Logger;
    serverInfo: ServerInfo;
    filter: HttpFilterExpression;
    filePath?: string;
    format?: ThymianFormat;
    sourceName?: string;
  },
): Promise<ThymianFormat> {
  if (
    typeof document.openapi !== 'string' ||
    !document.openapi.startsWith('3.1')
  ) {
    throw new ThymianBaseError('Only OpenAPI 3.1.x documents are supported.');
  }

  const locMapper =
    typeof options.filePath === 'string'
      ? await locMapperForFile(options.filePath)
      : new NoopLocMapper();

  return new OpenapiProcessor(
    options.logger ?? new NoopLogger(),
    options.serverInfo,
    locMapper,
    options.format,
  ).process(document, options.filter, options.sourceName);
}

export async function loadAndTransform(
  value: string,
  options: {
    logger: Logger;
    serverInfo: ServerInfo;
    cwd: string;
    filter: HttpFilterExpression;
    format?: ThymianFormat;
    sourceName?: string;
  },
): Promise<[OpenAPI.Document, ThymianFormat, string | undefined]> {
  const loadResult = await loadAndUpgrade(value, options.cwd, options.logger);

  const result = await openapiToThymianFormat(loadResult.document, {
    ...options,
    filePath: loadResult.filePath,
    filter: options.filter,
  });

  options.logger.debug('Transformed OpenAPI document into Thymian format.');

  return [loadResult.original, result, loadResult.filePath];
}
