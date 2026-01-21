import { mkdir, writeFile } from 'node:fs/promises';
import { basename, format, join } from 'node:path';

import { ThymianBaseError } from '@thymian/core';

import {
  type ContentSource,
  type HttpRequestSample,
  isFileContentSource,
  isInlineContentSource,
} from '../http-request-sample.js';
import { checkForSafePath, entryExists, sanitize } from '../utils.js';
import type { FileRequestSample, Value } from './file-request-sample.js';
import {
  type BaseNode,
  isKnownNodeType,
  isValidNodeType,
  type Node,
  nodeIsType,
  type SamplesStructure,
} from './samples-tree-structure.js';
import type { PathToNodeType } from './structure-meta-on-disc.js';
import { traverse, traverseAsync } from './traverse.js';

export type WriteToFile = (
  path: string,
  content: string | Buffer,
  encoding?: string,
) => Promise<void>;

export function getTreeStructureMeta(tree: SamplesStructure): PathToNodeType {
  const meta: PathToNodeType = {};

  traverse(tree, '', (node: BaseNode, currentPath) => {
    const path = join(currentPath, getFolderNameFromNode(node as Node));

    if (!isValidNodeType(node.type)) {
      throw new Error(`Invalid node type: ${node.type}`);
    }

    meta[path] = {
      type: node.type,
      ...(meta[path] ?? {}), // this ensures that we don't override the type of a node with type `samples` if it already exists. This can happen cause getFolderNameFromNode returns an empty string for samples nodes.
      containsSamples: nodeIsType(node, 'samples'),
    };

    return path;
  });

  return meta;
}

export function getFolderNameFromNode(node: BaseNode): string {
  if (!isKnownNodeType(node)) {
    throw new Error(`Unknown node type: ${node}`);
  }

  switch (node.type) {
    case 'host':
      return node.value;
    case 'port':
      return node.value.toString();
    case 'path':
      return sanitize(node.value);
    case 'pathParameter':
      return `[${sanitize(node.value)}]`;
    case 'method':
      return `@${sanitize(node.value.toUpperCase())}`;
    case 'requestMediaType':
      return node.value.replaceAll('/', '__');
    case 'responseMediaType':
      return node.value.replaceAll('/', '__');
    case 'statusCode':
      return node.value.toString();
    case 'samples':
      return '';
    case 'root':
      return '';
    case 'source': {
      if (!node.value) {
        throw new Error('Source Cannot be empty.');
      }
      return sanitize(node.value);
    }
    case 'requests':
      return 'requests';
    default:
      throw new Error(`Unknown node type: ${JSON.stringify(node)}`);
  }
}

export async function writeSample({
  sample,
  name,
  dir,
  writeToFile,
}: {
  sample: HttpRequestSample;
  name: string;
  dir: string;
  writeToFile: WriteToFile;
}): Promise<void> {
  const fileSample: FileRequestSample = {
    origin: sample.origin,
    path: sample.path,
    method: sample.method,
    authorize: sample.authorize,
    bodyEncoding: sample.bodyEncoding,
    headers: await transformParameters({
      parameters: sample.headers,
      baseName: `${name}_header`,
      dir,
      writeToFile,
    }),
    cookies: await transformParameters({
      parameters: sample.cookies,
      baseName: `${name}_cookie`,
      dir,
      writeToFile,
    }),
    pathParameters: await transformParameters({
      parameters: sample.pathParameters,
      baseName: `${name}_pathParameter`,
      dir,
      writeToFile,
    }),
    query: await transformParameters({
      parameters: sample.query,
      baseName: `${name}_query`,
      dir,
      writeToFile,
    }),
  };

  if (sample.body) {
    fileSample.body = await transformContentSource(
      sample.body,
      `${name}_body`,
      dir,
      writeToFile,
    );
  }

  const fullPath = format({
    ext: 'json',
    dir,
    name,
  });

  checkForSafePath(fullPath, dir);

  await writeToFile(fullPath, JSON.stringify(fileSample, null, 2));
}

async function transformContentSource(
  source: ContentSource,
  name: string,
  dir: string,
  writeToFile: WriteToFile,
): Promise<Value> {
  if (isInlineContentSource(source)) {
    return source.$content;
  } else if (isFileContentSource(source)) {
    const filePath = format({
      ext: source.$ext,
      dir,
      name,
    });

    checkForSafePath(filePath, dir);

    await writeToFile(filePath, source.$buffer, source.$encoding);

    return {
      $file: basename(filePath),
    };
  } else {
    throw new ThymianBaseError('Unknown content source type .' + source + name);
  }
}

export async function transformParameters({
  parameters,
  dir,
  baseName,
  writeToFile,
}: {
  parameters: Record<string, ContentSource>;
  baseName: string;
  dir: string;
  writeToFile: WriteToFile;
}): Promise<Record<string, Value>> {
  const transformedParameters: Record<string, Value> = {};

  for (const [parameterName, source] of Object.entries(parameters)) {
    transformedParameters[parameterName] = await transformContentSource(
      source,
      `${baseName}_${parameterName}`,
      dir,
      writeToFile,
    );
  }

  return transformedParameters;
}

export type WriteOptions = {
  path: string;
  mode?: 'failIfExist' | 'overwrite';
};

export async function writeSamplesToDir(
  samples: SamplesStructure,
  keyToTransactionId: Record<string, string>,
  options: WriteOptions,
): Promise<void> {
  const mode = options.mode ?? 'failIfExist';

  const writeToFile: WriteToFile = async (path, content, encoding) => {
    if (mode === 'failIfExist' && (await entryExists(path))) {
      throw new ThymianBaseError(
        `File/Directory at path "${path}" already exists. Use "overwrite" mode to overwrite it.`,
      );
    }

    await writeFile(path, content, encoding as BufferEncoding);
  };

  await mkdir(options.path, { recursive: true });

  await writeToFile(
    join(options.path, 'meta.json'),
    JSON.stringify({
      '//': 'This file contains metadata about the structure of the samples. It is generated by @thymian/sampler and is not meant to be edited by humans.',
      types: getTreeStructureMeta(samples),
      version: samples.meta,
      transactions: keyToTransactionId,
    }),
  );

  await traverseAsync(samples, options.path, async (node, currentPath) => {
    if (!isValidNodeType(node.type)) {
      throw new Error(`Invalid node type: ${node.type}`);
    }

    const folderName = getFolderNameFromNode(node);
    const dirPath = join(currentPath, folderName);

    if (nodeIsType(node, 'samples')) {
      await mkdir(dirPath, { recursive: true });

      const metaPath = join(dirPath, 'meta.json');

      await writeToFile(metaPath, JSON.stringify(node.meta, null, 2));
    } else if (nodeIsType(node, 'requests')) {
      await mkdir(dirPath, { recursive: true });

      for (const [idx, sample] of node.value.entries()) {
        const name = `${idx}-request`;

        await writeSample({ sample, name, dir: dirPath, writeToFile });
      }
    }

    return dirPath;
  });
}
