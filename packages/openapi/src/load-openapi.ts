import { isAbsolute, join, relative } from 'node:path';

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

function getRelativePath(filePath: string, cwd: string): string {
  try {
    return relative(cwd, filePath);
  } catch {
    return filePath;
  }
}

export type LoadResult = {
  document: OpenAPIV3_1.Document;
  original: OpenAPI.Document;
  filePath?: string;
};

export async function loadOpenApi(
  value: string,
  cwd: string = process.cwd(),
): Promise<{ document: object; filePath: string | undefined }> {
  const readFilesPlugin = readFiles();
  // the validate function of the readFiles plugin returns undefined if the value is not a local file
  const isFileValue = readFilesPlugin.validate(value);
  const finalValue =
    !isFileValue || (isFileValue && isAbsolute(value))
      ? value
      : join(cwd, value);

  const relativePath = isFileValue
    ? getRelativePath(finalValue, cwd)
    : undefined;

  const plugins = [parseJson(), parseYaml(), readFilesPlugin, fetchUrls()];

  try {
    return {
      document: await bundle(finalValue, {
        plugins,
        treeShake: false,
      }),
      filePath: finalValue,
    };
  } catch (e) {
    const suggestions = ['Ensure the content is valid YAML or JSON'];

    if (isFileValue) {
      suggestions.push(
        ...[
          `Verify the file path is correct: ${relativePath}`,
          'Check file permissions and ensure the file is readable',
        ],
      );
    }

    throw new ThymianBaseError(
      `Error in OpenAPI file ${relativePath ?? ''}: Failed to read or parse the document.`,
      {
        name: 'OpenAPIFileNotFoundError',
        ref: 'https://thymian.dev/references/errors/openapi-file-not-found-error/',
        cause: e,
        suggestions,
      },
    );
  }
}

export async function loadAndUpgrade(
  value: string,
  cwd: string = process.cwd(),
  logger: Logger,
): Promise<LoadResult> {
  const { document, filePath } = await loadOpenApi(value, cwd);
  const relativePath = filePath ? getRelativePath(filePath, cwd) : undefined;

  logger.info(`Loading OpenAPI file ${relativePath ?? ''}.`);

  const validationResult = await validate(document, { throwOnError: false });

  if (!validationResult.valid && validationResult.errors) {
    throw new ThymianBaseError(
      `Schema validation for OpenAPI file ${relativePath ?? ''} failed.`,
      {
        name: 'OpenAPIValidationError',
        ref: 'https://thymian.dev/references/errors/openapi-validation-error/',
        cause: new Error(
          validationResult.errors.map((e) => e.message).join('; '),
        ),
        suggestions: [
          'This indicates that your OpenAPI document does not match the OpenAPI specification. Use `thymian openapi:validate` to get detailed validation errors',
          'Ensure all required fields are present (openapi, info, paths)',
        ],
      },
    );
  }

  logger.debug(`Successfully validated OpenAPI file '${relativePath}'.`);

  const upgradedObject = upgrade(structuredClone(document), '3.1');

  logger.debug(`Upgraded OpenAPI file '${relativePath}' to version 3.1.`);

  const dereferencedResult = dereference(upgradedObject, {
    throwOnError: false,
  });

  if (dereferencedResult?.errors?.length || !dereferencedResult.schema) {
    logger.debug(`Cannot dereferenced OpenAPI file '${relativePath}'.`);
    throw new ThymianBaseError(
      `Error in OpenAPI file '${relativePath}': Dereferencing all internal references failed.`,
      {
        name: 'OpenAPIDereferenceError',
        cause: new Error(
          dereferencedResult?.errors?.map((e) => e.message).join('; ') ?? '',
        ),
        suggestions: [
          'Ensure all $refs are valid and resolve to a valid non-external location.',
        ],
      },
    );
  }

  return {
    document: dereferencedResult.schema as OpenAPIV3_1.Document,
    original: document as OpenAPI.Document,
    filePath: filePath ? filePath : undefined,
  };
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
  const cwd = process.cwd();
  const relativePath = options.filePath
    ? getRelativePath(options.filePath, cwd)
    : 'unknown file';

  if (
    typeof document.openapi !== 'string' ||
    !document.openapi.startsWith('3.1')
  ) {
    throw new ThymianBaseError(
      `Error in OpenAPI file ${relativePath ?? ''}: Only OpenAPI 3.1.x documents are supported.`,
      {
        name: 'OpenAPIDocumentVersionError',
      },
    );
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
  const relativePath = getRelativePath(
    loadResult.filePath || value,
    options.cwd,
  );

  const result = await openapiToThymianFormat(loadResult.document, {
    ...options,
    filePath: loadResult.filePath,
    filter: options.filter,
  });

  options.logger.debug(
    `Transformed OpenAPI file '${relativePath}' into Thymian format.`,
  );

  return [loadResult.original, result, loadResult.filePath];
}
