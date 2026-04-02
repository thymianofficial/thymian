import { readdir, readFile } from 'node:fs/promises';
import { type } from 'node:os';
import { basename, join } from 'node:path';

import { ThymianBaseError } from '@thymian/core';
import { createJiti } from 'jiti';

import {
  AFTER_EACH_HOOK,
  AUTHORIZE_HOOK,
  BEFORE_EACH_HOOK,
  SAMPLE_FILE,
} from '../constants.js';
import type {
  AfterEachResponseHook,
  AuthorizeHook,
  BeforeEachRequestHook,
} from '../hooks/hook-types.js';
import type {
  ContentSource,
  HttpRequestSample,
} from '../http-request-sample.js';
import { checkForSafePath } from '../utils.js';
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

const jiti = createJiti(import.meta.url);

export async function tryImport<T>(path: string): Promise<T> {
  const module = await jiti.import<T>(path, { default: true });

  if (module === null || typeof module !== 'function') {
    throw new ThymianBaseError(`Could not import hook from "${path}".`, {
      name: 'HookImportError',
      ref: 'https://thymian.dev/references/errors/hook-import-error/',
      suggestions: [
        'Check that the hook file exists and the hook function is exported as default.',
      ],
    });
  }

  return module;
}

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
    cookies: await extractParameterValues(fileSample.cookies, path),
    headers: await extractParameterValues(fileSample.headers, path),
    method: fileSample.method,
    origin: fileSample.origin,
    path: fileSample.path,
    pathParameters: await extractParameterValues(
      fileSample.pathParameters,
      path,
    ),
    query: await extractParameterValues(fileSample.query, path),
    bodyEncoding: fileSample.bodyEncoding,
  };

  if (fileSample.body) {
    if (isFileValue(fileSample.body)) {
      const bodyPath = join(path, fileSample.body.$file);

      checkForSafePath(bodyPath, path);

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
    hooks: await extractHooksFromDir(dir),
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

export async function extractHooksFromDir(dir: string): Promise<Hooks> {
  const hooks: Hooks = {
    afterEachResponse: [],
    authorize: [],
    beforeEachRequest: [],
  };

  for (const dirent of await readdir(dir, {
    recursive: false,
    withFileTypes: true,
  })) {
    if (dirent.isFile()) {
      const filePath = join(dir, dirent.name);

      if (BEFORE_EACH_HOOK.test(dirent.name)) {
        hooks.beforeEachRequest.push(
          await tryImport<BeforeEachRequestHook>(filePath),
        );
      }

      if (AFTER_EACH_HOOK.test(dirent.name)) {
        hooks.afterEachResponse.push(
          await tryImport<AfterEachResponseHook>(filePath),
        );
      }

      if (AUTHORIZE_HOOK.test(dirent.name)) {
        hooks.authorize.push(await tryImport<AuthorizeHook>(filePath));
      }
    }
  }

  return hooks;
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
      hooks: await extractHooksFromDir(fullPath),
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
    hooks: await extractHooksFromDir(dir),
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
