import { access } from 'node:fs/promises';
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

function formatSourceLabel(relativePath: string | undefined): string {
  return relativePath ? `'${relativePath}'` : 'the OpenAPI document';
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
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
      filePath: isFileValue ? finalValue : undefined,
    };
  } catch (e) {
    if (isFileValue && !(await fileExists(finalValue))) {
      throw new ThymianBaseError(
        `OpenAPI file not found: ${relativePath ?? value}`,
        {
          name: 'OpenAPIFileNotFoundError',
          ref: 'https://thymian.dev/references/errors/openapi-file-not-found-error/',
          cause: e,
          suggestions: [
            `Verify the file path is correct: ${relativePath ?? value}`,
            'Check file permissions and ensure the file is readable',
          ],
        },
      );
    }

    const sourceLabel = relativePath ? `'${relativePath}'` : 'the document';

    throw new ThymianBaseError(`Failed to read or parse ${sourceLabel}.`, {
      name: 'OpenAPILoadError',
      cause: e,
      suggestions: [
        'Ensure the content is valid YAML or JSON',
        ...(isFileValue
          ? [
              `Verify the file path is correct: ${relativePath ?? value}`,
              'Check file permissions and ensure the file is readable',
            ]
          : []),
      ],
    });
  }
}

export async function loadAndUpgrade(
  value: string,
  cwd: string = process.cwd(),
  logger: Logger,
  skipValidation = false,
): Promise<LoadResult> {
  const { document, filePath } = await loadOpenApi(value, cwd);
  const relativePath = filePath ? getRelativePath(filePath, cwd) : undefined;

  const sourceLabel = formatSourceLabel(relativePath);

  logger.info(`Loading ${sourceLabel}.`);

  const validationResult = await validate(document, { throwOnError: false });

  if (!validationResult.valid && validationResult.errors) {
    const refErrors = validationResult.errors.filter(
      (err) => err.code === 'INVALID_REFERENCE',
    );

    if (refErrors.length > 0) {
      throw new ThymianBaseError(
        `Invalid $ref${refErrors.length > 1 ? 's' : ''} found: ${refErrors.map((err) => err.message).join(', ')}`,
        {
          name: 'OpenAPIDereferenceError',
          ref: 'https://thymian.dev/references/errors/openapi-dereference-error/',
          cause: new Error(
            validationResult?.errors?.map((e) => e.message).join('; ') ?? '',
          ),
          suggestions: [
            'Ensure all $refs are valid and resolve to a valid non-external location.',
          ],
        },
      );
    }

    if (skipValidation) {
      logger.warn(
        `Schema validation for ${sourceLabel} failed, but --skip-spec-validation is set. Continuing anyway.`,
      );
    } else {
      throw new ThymianBaseError(
        `Schema validation for ${sourceLabel} failed.`,
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
  } else {
    logger.debug(`Successfully validated ${sourceLabel}.`);
  }

  const upgradedObject = upgrade(structuredClone(document), '3.1');

  logger.debug(`Upgraded ${sourceLabel} to version 3.1.`);

  const dereferencedResult = dereference(upgradedObject, {
    throwOnError: false,
  });

  if (dereferencedResult?.errors?.length || !dereferencedResult.schema) {
    logger.debug(`Cannot dereference ${sourceLabel}.`);
    throw new ThymianBaseError(
      `Dereferencing all internal references in ${sourceLabel} failed.`,
      {
        name: 'OpenAPIDereferenceError',
        ref: 'https://thymian.dev/references/errors/openapi-dereference-error/',
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
    cwd?: string;
  },
): Promise<ThymianFormat> {
  const sourceLabel = options.filePath
    ? formatSourceLabel(
        getRelativePath(options.filePath, options.cwd ?? process.cwd()),
      )
    : formatSourceLabel(undefined);

  if (
    typeof document.openapi !== 'string' ||
    !document.openapi.startsWith('3.1')
  ) {
    throw new ThymianBaseError(
      `Only OpenAPI 3.1.x documents are supported (found in ${sourceLabel}).`,
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
    skipValidation?: boolean;
  },
): Promise<[OpenAPI.Document, ThymianFormat, string | undefined]> {
  const loadResult = await loadAndUpgrade(
    value,
    options.cwd,
    options.logger,
    options.skipValidation,
  );
  const relativePath = loadResult.filePath
    ? getRelativePath(loadResult.filePath, options.cwd)
    : undefined;

  const result = await openapiToThymianFormat(loadResult.document, {
    ...options,
    filePath: loadResult.filePath,
    filter: options.filter,
    cwd: options.cwd,
  });

  options.logger.debug(
    `Transformed ${formatSourceLabel(relativePath)} into Thymian format.`,
  );

  return [loadResult.original, result, loadResult.filePath];
}
