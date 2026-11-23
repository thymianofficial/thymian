import { access } from 'node:fs/promises';
import { isAbsolute, join, relative, sep, win32 } from 'node:path';

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
  type SpecValidationIssue,
  type SpecValidationResult,
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

type ParserError = { code?: string; message: string };

const MISSING_FILE_CODE = 'EXTERNAL_REFERENCE_NOT_FOUND';
// The parser reports a missing file as this prefix followed by the file as the $ref wrote it.
const MISSING_FILE_MESSAGE_PREFIX = "Can't resolve external reference: ";

function isReferenceError(error: ParserError): boolean {
  return error.code === 'INVALID_REFERENCE' || error.code === MISSING_FILE_CODE;
}

function isMissingFileError(error: ParserError): boolean {
  return error.code === MISSING_FILE_CODE;
}

function plural(count: number, word: string): string {
  return count > 1 ? `${word}s` : word;
}

const URL_REF_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

// A relative ref is resolved against the document containing it; a URL or an absolute path is not.
// win32.isAbsolute accepts both POSIX (`/x`) and Windows (`C:\x`) absolute paths, on every platform.
function isRelativeRef(ref: string): boolean {
  return !URL_REF_PATTERN.test(ref) && !win32.isAbsolute(ref);
}

// The headline is shown in the terminal, so a URL loses its credentials and query string there.
function redactUrlRef(ref: string): string {
  if (!URL_REF_PATTERN.test(ref)) {
    return ref;
  }

  try {
    const url = new URL(ref);
    url.username = '';
    url.password = '';
    url.search = '';
    return url.toString();
  } catch {
    const queryStart = ref.indexOf('?');
    return queryStart === -1 ? ref : ref.slice(0, queryStart);
  }
}

function missingFileClause(errors: ParserError[]): string | undefined {
  const files = errors
    .filter(isMissingFileError)
    .map(({ message }) =>
      message.startsWith(MISSING_FILE_MESSAGE_PREFIX)
        ? message.slice(MISSING_FILE_MESSAGE_PREFIX.length)
        : message,
    );

  if (files.length === 0) {
    return undefined;
  }

  const resolutionNote = files.every(isRelativeRef)
    ? ' (resolved relative to the document containing the $ref)'
    : '';

  return `${plural(files.length, 'Referenced file')} could not be loaded: ${files.map((file) => `'${redactUrlRef(file)}'`).join(', ')}${resolutionNote}.`;
}

function createDereferenceError(
  clauses: (string | undefined)[],
  errors: ParserError[],
): ThymianBaseError {
  return new ThymianBaseError(
    clauses.filter((clause) => clause !== undefined).join(' '),
    {
      name: 'OpenAPIDereferenceError',
      ref: 'https://thymian.dev/references/errors/openapi-dereference-error/',
      cause: new Error(errors.map((e) => e.message).join('; ')),
      suggestions: [
        'Ensure every $ref points to an existing location: a JSON pointer within its document, a file path (relative paths resolve against the document containing the $ref), or a reachable URL.',
        ...(errors.some(isMissingFileError)
          ? [
              'Check that each referenced file or URL exists and is readable, and that relative paths are spelled correctly.',
            ]
          : []),
      ],
    },
  );
}

function validateStepReferenceError(
  refErrors: ParserError[],
  allErrors: ParserError[],
): ThymianBaseError {
  const pointerErrors = refErrors.filter((e) => !isMissingFileError(e));
  const pointerClause =
    pointerErrors.length > 0
      ? `${plural(pointerErrors.length, 'Invalid $ref')} found: ${pointerErrors.map((e) => e.message).join('; ')}.`
      : undefined;

  return createDereferenceError(
    [missingFileClause(refErrors), pointerClause],
    allErrors,
  );
}

function dereferenceStepReferenceError(
  sourceLabel: string,
  errors: ParserError[],
): ThymianBaseError {
  const missingFiles = missingFileClause(errors);
  const otherErrors = errors.filter((e) => !isMissingFileError(e));
  const resolvingClause =
    otherErrors.length > 0 || !missingFiles
      ? `Resolving the $refs in ${sourceLabel} failed${otherErrors.length > 0 ? `: ${otherErrors.map((e) => e.message).join('; ')}` : ''}.`
      : undefined;

  return createDereferenceError([missingFiles, resolvingClause], errors);
}

export type LoadResult = {
  document: OpenAPIV3_1.Document;
  original: OpenAPI.Document;
  filePath?: string;
};

function mapValidationIssue(error: {
  message: string;
  code?: string;
  path?: unknown;
}): SpecValidationIssue {
  const normalizedPath = Array.isArray(error.path)
    ? error.path.join('.')
    : typeof error.path === 'string'
      ? error.path
      : undefined;

  return {
    message: error.message,
    code: error.code,
    path: normalizedPath,
  };
}

function createToolErrorResult(
  value: string,
  source: string,
  error: ThymianBaseError,
  filePath?: string,
): SpecValidationResult {
  return {
    type: 'openapi',
    location: value,
    source,
    status: 'error',
    issues: [
      {
        message: error.message,
        code: error.name,
      },
    ],
    metadata: {
      ...(filePath ? { filePath } : {}),
    },
  };
}

export async function loadOpenApi(
  value: string,
  cwd: string = process.cwd(),
): Promise<{
  document: Record<string, unknown>;
  filePath: string | undefined;
}> {
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
      // The bundler resolves relative $refs with a POSIX-only path helper, so on
      // Windows it cannot find the directory of `D:\a\openapi.yaml` and looks up
      // `./paths/user.yaml` from the process cwd instead. Node reads `D:/a/...` fine.
      // bundle() types its result as `object`, but a parsed JSON/YAML document is always a record
      document: (await bundle(
        isFileValue ? finalValue.split(sep).join('/') : finalValue,
        {
          plugins,
          treeShake: false,
        },
      )) as Record<string, unknown>,
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
  validateSpecs = false,
): Promise<LoadResult> {
  const { document, filePath } = await loadOpenApi(value, cwd);
  const relativePath = filePath ? getRelativePath(filePath, cwd) : undefined;

  const sourceLabel = formatSourceLabel(relativePath);

  logger.info(`Loading ${sourceLabel}.`);

  const validationResult = await validate(document, { throwOnError: false });

  if (!validationResult.valid && validationResult.errors) {
    const refErrors = validationResult.errors.filter(isReferenceError);

    if (refErrors.length > 0) {
      throw validateStepReferenceError(refErrors, validationResult.errors);
    }

    if (validateSpecs) {
      throw new ThymianBaseError(
        `Schema validation for ${sourceLabel} failed.`,
        {
          name: 'OpenAPIValidationError',
          ref: 'https://thymian.dev/references/errors/openapi-validation-error/',
          cause: new Error(
            validationResult.errors.map((e) => e.message).join('; '),
          ),
          suggestions: [
            'This indicates that your OpenAPI document does not match the OpenAPI specification. Use `thymian validate --spec openapi:<path>` to get detailed validation errors',
            'Ensure all required fields are present (openapi, info, paths)',
          ],
        },
      );
    } else {
      const formattedValidationErrors =
        validationResult.errors
          ?.map((e) => {
            const errorPath =
              'path' in e
                ? ` (at ${(e as Record<string, unknown>)['path']})`
                : '';
            return `  - ${e.message}${errorPath}`;
          })
          .join('\n') ?? '';

      logger.warn(
        `Schema validation for ${sourceLabel} failed.${formattedValidationErrors ? `\nErrors:\n${formattedValidationErrors}` : ''}`,
      );
    }
  } else {
    logger.debug(`Successfully validated ${sourceLabel}.`);
  }

  const upgradedObject = upgrade(structuredClone(document), '3.1');

  logger.debug(`Upgraded ${sourceLabel} to version 3.1.`);

  const dereferencedResult = dereference(structuredClone(upgradedObject), {
    throwOnError: false,
  });

  if (dereferencedResult?.errors?.length || !dereferencedResult.schema) {
    logger.debug(`Cannot dereference ${sourceLabel}.`);
    throw dereferenceStepReferenceError(
      sourceLabel,
      dereferencedResult?.errors ?? [],
    );
  }

  return {
    document: upgradedObject as OpenAPIV3_1.Document,
    original: document as OpenAPI.Document,
    filePath: filePath ? filePath : undefined,
  };
}

export async function validateOpenApi(
  value: string,
  options: {
    cwd: string;
    logger?: Logger;
    sourceName?: string;
  },
): Promise<SpecValidationResult> {
  const logger = options.logger ?? new NoopLogger();
  let filePath: string | undefined;
  let source = options.sourceName ?? value;

  try {
    const loadResult = await loadOpenApi(value, options.cwd);
    const { document } = loadResult;
    filePath = loadResult.filePath;
    const relativePath = filePath
      ? getRelativePath(filePath, options.cwd)
      : value;
    source = options.sourceName ?? relativePath;

    const validationResult = await validate(document, { throwOnError: false });

    if (!validationResult.valid && validationResult.errors) {
      const issues = validationResult.errors.map(mapValidationIssue);
      const hasReferenceErrors = validationResult.errors.some(isReferenceError);

      logger.info(`OpenAPI validation failed for '${source}'.`);

      return {
        type: 'openapi',
        location: value,
        source,
        status: 'failed',
        issues,
        metadata: {
          filePath,
          hasReferenceErrors,
        },
      };
    }

    const upgradedObject = upgrade(structuredClone(document), '3.1');
    const dereferencedResult = dereference(upgradedObject, {
      throwOnError: false,
    });

    if (dereferencedResult?.errors?.length || !dereferencedResult.schema) {
      logger.debug(`Cannot dereference '${source}'.`);
      throw dereferenceStepReferenceError(
        formatSourceLabel(source),
        dereferencedResult?.errors ?? [],
      );
    }

    logger.debug(`Successfully validated '${source}'.`);

    return {
      type: 'openapi',
      location: value,
      source,
      status: 'success',
      issues: [],
      metadata: {
        filePath,
      },
    };
  } catch (error) {
    if (error instanceof ThymianBaseError) {
      return createToolErrorResult(value, source, error, filePath);
    }

    throw error;
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
    validateSpecs?: boolean;
  },
): Promise<[OpenAPI.Document, ThymianFormat, string | undefined]> {
  const loadResult = await loadAndUpgrade(
    value,
    options.cwd,
    options.logger,
    options.validateSpecs,
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
