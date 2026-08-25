import { readdir, readFile } from 'node:fs/promises';
import { type } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { type Logger, ThymianBaseError } from '@thymian/core';

import { SAMPLE_FILE } from '../constants.js';
import type {
  ContentSource,
  HttpRequestSample,
} from '../http-request-sample.js';
import {
  checkForSafePath,
  entryExists,
  PATH_TRAVERSAL_ERROR_NAME,
} from '../utils.js';
import {
  type FileRequestSample,
  isFileValue,
  type Value,
} from './file-request-sample.js';
import type {
  Hooks,
  Node,
  NodeTypes,
  RequestsNode,
  SamplesNode,
  SamplesNodeMeta,
  SamplesStructure,
} from './samples-tree-structure.js';
import type {
  PathToNodeType,
  StructureMetaOnDisc,
} from './structure-meta-on-disc.js';

export async function extractParameterValues(
  parameters: Record<string, Value>,
  basePath: string,
): Promise<Record<string, ContentSource>> {
  const result: Record<string, ContentSource> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (isFileValue(value)) {
      const fullPath = join(basePath, value.$file);

      checkForSafePath(fullPath, basePath);

      result[key] = {
        $content: await readFile(
          fullPath,
          (value.$encoding ?? 'utf-8') as BufferEncoding,
        ),
      };
    } else {
      result[key] = {
        $content: value,
      };
    }
  }

  return result;
}

export async function extractSample(path: string): Promise<HttpRequestSample> {
  const sampleFile = await readFile(path, 'utf-8');
  const requestsDir = dirname(path);
  let fileSample!: FileRequestSample;

  try {
    fileSample = JSON.parse(sampleFile) as FileRequestSample;
  } catch (err) {
    throw new ThymianBaseError(`Could not parse JSON sample file "${path}".`, {
      name: 'InvalidSampleJSONError',
      ref: 'https://thymian.dev/references/errors/invalid-sample-json-error/',
      suggestions: ['Check that the sample file is valid JSON.'],
      cause: err,
    });
  }

  const sample: HttpRequestSample = {
    authorize: fileSample.authorize,
    cookies: await extractParameterValues(fileSample.cookies, requestsDir),
    headers: await extractParameterValues(fileSample.headers, requestsDir),
    method: fileSample.method,
    origin: fileSample.origin,
    path: fileSample.path,
    pathParameters: await extractParameterValues(
      fileSample.pathParameters,
      requestsDir,
    ),
    query: await extractParameterValues(fileSample.query, requestsDir),
    bodyEncoding: fileSample.bodyEncoding,
  };

  if (fileSample.body) {
    if (isFileValue(fileSample.body)) {
      const bodyPath = join(requestsDir, fileSample.body.$file);

      checkForSafePath(bodyPath, requestsDir);

      sample.body = {
        $content: await readFile(
          bodyPath,
          (fileSample.body.$encoding ??
            fileSample.bodyEncoding ??
            'utf-8') as BufferEncoding,
        ),
      };
    } else {
      sample.body = {
        $content: fileSample.body,
      };
    }
  }

  return sample;
}

export async function extractSamplesNode<
  T extends Exclude<Node, SamplesNode | SamplesStructure>['type'],
>(dir: string, type: T): Promise<NodeTypes[T]> {
  const metaPath = join(dir, 'meta.json');

  const meta = JSON.parse(await readFile(metaPath, 'utf-8')) as SamplesNodeMeta;

  const request: RequestsNode = {
    children: [],
    type: 'requests',
    value: [],
  };

  for (const dirent of await readdir(join(dir, 'requests'), {
    recursive: false,
    withFileTypes: true,
  })) {
    if (dirent.isFile() && SAMPLE_FILE.test(dirent.name)) {
      request.value.push(
        await extractSample(join(dir, 'requests', dirent.name)),
      );
    }
  }

  const samplesNode: SamplesNode = {
    meta,
    type: 'samples',
    hooks: extractHooksFromDir(dir),
    children: [request],
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return {
    type,
    children: [samplesNode],
    value: dirNameToValue(basename(dir), type),
  };
}

/**
 * The empty hook set, without reading the directory.
 *
 * v1 discovered hooks by importing `beforeEach.ts` / `afterEach.ts` /
 * `authorize.ts` out of every node of the samples tree. Story 575.9 replaced that
 * wholesale with `loadUserHooks`, which scans `.thymian/sampler/hooks/` — so
 * nothing reads `node.hooks` any more. Importing those files anyway would execute
 * user module side effects for hooks that are then discarded, and could raise a
 * `HookImportError` for a file the sampler no longer uses.
 *
 * The function and its return shape survive so `mergeHooks` in `merge-tree.ts` is
 * unaffected. Both die in 575.10 with the rest of the tree.
 *
 * Synchronous, because there is nothing left to await: it reads no directory and
 * builds a constant. It stayed `async` after the body was emptied, so all three
 * call sites `await`ed a value that was never a promise.
 *
 * `dir` stays in the signature on purpose, and not only to leave the call sites
 * alone: the #615 tests hand it a directory containing a v1 `beforeEach.ts` whose
 * import would leave a marker file behind, and assert the marker never appears.
 * A parameterless function could not carry that evidence.
 */
export function extractHooksFromDir(dir: string): Hooks {
  void dir;

  return {
    afterEachResponse: [],
    authorize: [],
    beforeEachRequest: [],
  };
}

export function dirNameToValue(
  dirName: string,
  type: Exclude<Node, SamplesNode | SamplesStructure>['type'],
): string {
  switch (type) {
    case 'pathParameter':
      return `${dirName.substring(1, dirName.length - 1)}`;
    case 'method':
      return dirName.replace('@', '').toLowerCase();
    default:
      return dirName;
  }
}

export async function extractNodes(
  baseDir: string,
  relativeDir: string,
  currentDirName: string,
  meta: PathToNodeType,
): Promise<Node> {
  const { type, containsSamples } = meta[relativeDir] ?? {};

  if (typeof type === 'undefined') {
    throw new Error(`Unknown type: ${relativeDir}`);
  }

  if (type === 'root' || type === 'samples') {
    throw new Error('Cannot extract root node from samples directory.');
  }

  const fullPath = join(baseDir, relativeDir);

  if (containsSamples) {
    return await extractSamplesNode(fullPath, type);
  } else if (type === 'requests') {
    /**
     * is extracted within the extractSamplesNode function
     */
    throw new Error('Should not happen');
  } else {
    const fullPath = join(baseDir, relativeDir);

    const node: Exclude<Node, SamplesNode | SamplesStructure> = {
      value: dirNameToValue(currentDirName, type),
      children: [],
      type,
      hooks: extractHooksFromDir(fullPath),
    } as const;

    for (const dirent of await readdir(fullPath, {
      recursive: false,
      withFileTypes: true,
    })) {
      if (dirent.isDirectory()) {
        node.children.push(
          await extractNodes(
            baseDir,
            join(relativeDir, dirent.name),
            dirent.name,
            meta,
          ),
        );
      }
    }

    return node;
  }
}

export async function readSamplesFromDir(
  dir: string,
): Promise<SamplesStructure> {
  const meta = JSON.parse(
    await readFile(join(dir, 'meta.json'), 'utf-8'),
  ) as StructureMetaOnDisc;

  const samples: SamplesStructure = {
    children: [],
    meta: meta.version,
    type: 'root',
    hooks: extractHooksFromDir(dir),
  };

  for (const dirent of await readdir(dir, {
    recursive: false,
    withFileTypes: true,
  })) {
    if (dirent.isDirectory()) {
      samples.children.push(
        await extractNodes(dir, dirent.name, dirent.name, meta.types),
      );
    }
  }

  return samples;
}

/** Walks `error` and its `cause` chain, cycle-safe, deepest wrap included. */
function* causeChain(error: unknown): Generator<object> {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (
    typeof current === 'object' &&
    current !== null &&
    !seen.has(current)
  ) {
    seen.add(current);
    yield current;
    current = (current as { cause?: unknown }).cause;
  }
}

/**
 * The one error this guard must **not** swallow.
 *
 * `checkForSafePath` raises `PathTraversalError` ({@link PATH_TRAVERSAL_ERROR_NAME})
 * to make a sample file escaping its base directory a hard failure, and
 * `readSamplesFromDir` is its only remaining call path (`index.ts`) — a bare
 * `catch` here made that error unreachable, downgrading a refused path traversal
 * to `logger.debug`.
 *
 * The whole `cause` chain is inspected, not just the top-level error: anything
 * that wraps the refusal on its way up would otherwise be demoted, which is the
 * bare `catch` defect wearing a different hat.
 */
export function isPathTraversalError(error: unknown): boolean {
  for (const link of causeChain(error)) {
    if ((link as { name?: unknown }).name === PATH_TRAVERSAL_ERROR_NAME) {
      return true;
    }
  }

  return false;
}

/**
 * `EACCES`/`EPERM` anywhere in the chain, so the debug line can name the actual
 * problem instead of the generic one.
 */
function permissionCode(error: unknown): string | undefined {
  for (const link of causeChain(error)) {
    const code: unknown = (link as { code?: unknown }).code;

    if (code === 'EACCES' || code === 'EPERM') {
      return code;
    }
  }

  return undefined;
}

/**
 * The samples tree, or `undefined` when there is nothing usable there — never an
 * exception (#613, AC 12).
 *
 * `entryExists` only `access()`es the directory, while `meta.json` is read
 * unguarded here and again in `extractSamplesNode`. A leftover, empty or
 * interrupted `.thymian/samples` therefore raised ENOENT (or a JSON parse error)
 * inside `core.format` and killed a `thymian test` that requires no tree at all.
 * Story 575.1's AC 1 already named an **empty** tree alongside "absent or stale",
 * so this is closer to an unmet acceptance criterion than to a deferral.
 *
 * Degrading to `undefined` is safe because exactly one thing still needs the tree:
 * `sampler.path-from-transaction`, which throws its own `SamplesNotLoadedError`
 * when something actually invokes it. The honest failure stays confined to the one
 * command that needs a tree.
 *
 * **A forbidden tree degrades too.** `EACCES`/`EPERM` used to be re-raised, which
 * contradicted AC 9 (*"never throws out of `core.format`"*) and AC 12 (*"present
 * but unreadable … still runs clean"*): a root-created `.thymian/samples` in a
 * container, or a CI job running as a different user, is the paradigm
 * "present but unreadable" case, and it hard-failed `test`, `sampler init` and
 * `sampler check` alike — none of which need the tree. The objection that put the
 * re-raise here was to the wrong *diagnosis* (`No samples are loaded.` for a tree
 * that is right there), and that is answered by naming `EACCES` in the debug line
 * instead of by killing the run.
 *
 * `PathTraversalError` stays hard. It is not a tree we *cannot* read; it is a tree
 * we have decided we *must not*.
 */
export async function readSamplesFromDirIfUsable(
  dir: string,
  logger: Logger,
): Promise<SamplesStructure | undefined> {
  if (!(await entryExists(dir))) {
    return undefined;
  }

  try {
    return await readSamplesFromDir(dir);
  } catch (error) {
    if (isPathTraversalError(error)) {
      throw error;
    }

    const denied = permissionCode(error);

    logger.debug(
      denied
        ? `Ignoring the samples tree at "${dir}": this process may not read it (${denied}). ` +
            `Only "sampler.path-from-transaction" needs it — fix the permissions if you use it.`
        : `Ignoring the samples tree at "${dir}": it exists but could not be read (${
            error instanceof Error ? error.message : String(error)
          }). Only "sampler.path-from-transaction" needs it.`,
    );

    return undefined;
  }
}
