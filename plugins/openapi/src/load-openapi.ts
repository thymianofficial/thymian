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
  type Logger,
  NoopLogger,
  ThymianBaseError,
  type ThymianFormat,
} from '@thymian/core';
import type { OpenAPIV3_1 } from 'openapi-types';

import { locMapperForFile } from './loc-mapper/loc-mapper-for-file.js';
import { NoopLocMapper } from './loc-mapper/noop-loc-mapper.js';
import type { ServerInfo } from './processors/extract-server-info.js';
import { OpenapiProcessor } from './processors/openapi.processor.js';

export async function loadAndUpgrade(
  value: string,
): Promise<OpenAPIV3_1.Document> {
  try {
    const plugins = [parseJson(), parseYaml(), readFiles(), fetchUrls()];

    const result = await bundle(value, {
      plugins,
      treeShake: false,
    });

    await validate(result, { throwOnError: true });

    const upgradedObject = upgrade(result, '3.1');

    return dereference(upgradedObject, {
      throwOnError: true,
    }).schema as OpenAPIV3_1.Document;
  } catch (e) {
    throw new ThymianBaseError(`Error while loading OpenAPI document.`, {
      cause: e,
      suggestions: [
        'Currently, only files without external references are supported. Do your OpenAPI documents contain any external references?',
      ],
    });
  }
}

export async function openapiToThymianFormat(
  document: OpenAPIV3_1.Document,
  options: {
    logger?: Logger;
    serverInfo: ServerInfo;
    filePath?: string;
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
  ).process(document);
}

export async function loadAndTransform(
  value: string,
  options: {
    logger: Logger;
    serverInfo: ServerInfo;
    filePath?: string;
  },
): Promise<[OpenAPIV3_1.Document, ThymianFormat]> {
  const document = await loadAndUpgrade(value);

  return [document, await openapiToThymianFormat(document, options)];
}
