import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { diff as diffJson, type Difference } from '@scalar/json-magic/diff';
import type { ThymianEmitter, ThymianFormat } from '@thymian/core';

import { isHookFileName } from '../constants.js';
import { generateSamplesForThymianFormat } from '../generation/generate-samples-for-thymian-format.js';
import {
  generatedTypesToString,
  generateTypesForThymianFormat,
} from '../hooks/generate-request-types.js';
import { tsConfig } from '../hooks/ts-config.js';
import { writeSamplesToDir } from '../samples-structure/write-samples-to-dir.js';
import { entryExists } from '../utils.js';

export type SamplerValidationFindingType =
  | 'missing-artifact'
  | 'unexpected-artifact'
  | 'changed-artifact'
  | 'stale-root-metadata'
  | 'metadata-out-of-sync'
  | 'invalid-json';

export type SamplerValidationContentChangeType = 'add' | 'update' | 'delete';

export type SamplerValidationContentChange = {
  type: SamplerValidationContentChangeType;
  pointer: string;
  expected?: unknown;
  actual?: unknown;
};

export type SamplerValidationFinding = {
  type: SamplerValidationFindingType;
  path: string;
  message: string;
  expected?: string;
  actual?: string;
  changes?: SamplerValidationContentChange[];
};

export type SamplerValidationReport = {
  samplePath: string;
  checkedArtifacts: number;
  failures: SamplerValidationFinding[];
};

type ValidateSamplerOutputOptions = {
  format: ThymianFormat;
  emitter: ThymianEmitter;
  samplePath: string;
  /**
   * Restrict the report to a single generated artifact, identified by its
   * relative path (e.g. `meta.json`). `checkedArtifacts` is then 1 when the
   * path is a known artifact and 0 when it is not, which the CLI uses to tell
   * an in-sync artifact apart from an unknown one.
   */
  forPath?: string;
};

export async function createExpectedSamplerFiles({
  format,
  emitter,
}: Omit<ValidateSamplerOutputOptions, 'samplePath'>): Promise<
  Map<string, Buffer>
> {
  const samples = await generateSamplesForThymianFormat(format, emitter);
  const generatedTypes = await generateTypesForThymianFormat(format);
  const expectedFiles = new Map<string, Buffer>();

  await writeSamplesToDir(samples, generatedTypes.keyToTransactionId, {
    path: '',
    mkdir: async (path) => {
      void path;
    },
    writeToFile: async (path, content, encoding) => {
      expectedFiles.set(
        normalizeRelativePath(path),
        Buffer.isBuffer(content)
          ? content
          : Buffer.from(content, encoding as BufferEncoding | undefined),
      );
    },
  });

  expectedFiles.set(
    'types.d.ts',
    Buffer.from(generatedTypesToString(generatedTypes)),
  );
  expectedFiles.set(
    'tsconfig.json',
    Buffer.from(JSON.stringify(tsConfig, null, 2)),
  );

  return expectedFiles;
}

export async function validateSamplerOutput({
  format,
  emitter,
  samplePath,
  forPath,
}: ValidateSamplerOutputOptions): Promise<SamplerValidationReport> {
  const expectedFiles = await createExpectedSamplerFiles({ format, emitter });
  const actualFiles = await collectActualSamplerFiles(samplePath);
  const failures: SamplerValidationFinding[] = [];

  preserveRootMetadataTimestamp(expectedFiles, actualFiles);

  for (const [path, expected] of expectedFiles) {
    const actual = actualFiles.get(path);

    if (!actual) {
      failures.push({
        type: 'missing-artifact',
        path,
        message: 'Expected generated sampler artifact is missing.',
        expected: bufferToText(expected),
      });
      continue;
    }

    if (expected.equals(actual)) {
      continue;
    }

    const type = mismatchTypeForChangedPath(path, expected, actual);
    const changes = createJsonDiffDetails(expected, actual);

    failures.push({
      type,
      path,
      message: messageForChangedPath(type),
      expected: bufferToText(expected),
      actual: bufferToText(actual),
      ...(changes ? { changes } : {}),
    });
  }

  for (const [path, actual] of actualFiles) {
    if (!expectedFiles.has(path)) {
      failures.push({
        type: 'unexpected-artifact',
        path,
        message: 'Unexpected non-hook file exists under the sampler directory.',
        actual: bufferToText(actual),
      });
    }
  }

  if (forPath !== undefined) {
    const known = expectedFiles.has(forPath) || actualFiles.has(forPath);

    return {
      samplePath,
      checkedArtifacts: known ? 1 : 0,
      failures: failures.filter((failure) => failure.path === forPath),
    };
  }

  return {
    samplePath,
    checkedArtifacts: expectedFiles.size,
    failures,
  };
}

async function collectActualSamplerFiles(
  samplePath: string,
): Promise<Map<string, Buffer>> {
  const actualFiles = new Map<string, Buffer>();

  if (!(await entryExists(samplePath))) {
    return actualFiles;
  }

  await collectActualFilesRecursive(samplePath, samplePath, actualFiles);

  return actualFiles;
}

async function collectActualFilesRecursive(
  rootPath: string,
  currentPath: string,
  actualFiles: Map<string, Buffer>,
): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await collectActualFilesRecursive(rootPath, entryPath, actualFiles);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = normalizeRelativePath(relative(rootPath, entryPath));

    if (isHookFile(relativePath)) {
      continue;
    }

    actualFiles.set(relativePath, await readFile(entryPath));
  }
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join('/');
}

function isHookFile(path: string): boolean {
  const fileName = path.split('/').at(-1) ?? path;
  return isHookFileName(fileName);
}

function mismatchTypeForChangedPath(
  path: string,
  expected: Buffer,
  actual: Buffer,
): Exclude<
  SamplerValidationFindingType,
  'missing-artifact' | 'unexpected-artifact'
> {
  if (isInvalidJsonChange(expected, actual)) {
    return 'invalid-json';
  }

  if (path === 'meta.json') {
    return 'stale-root-metadata';
  }

  if (path.endsWith('/meta.json')) {
    return 'metadata-out-of-sync';
  }

  return 'changed-artifact';
}

function messageForChangedPath(
  type: Exclude<
    SamplerValidationFindingType,
    'missing-artifact' | 'unexpected-artifact'
  >,
): string {
  if (type === 'invalid-json') {
    return 'Generated JSON artifact is not valid JSON.';
  }

  if (type === 'stale-root-metadata') {
    return 'Root sampler metadata does not match the current API format.';
  }

  if (type === 'metadata-out-of-sync') {
    return 'Nested sampler metadata does not match the expected generated output.';
  }

  return 'Generated sampler artifact content differs from expected output.';
}

function isInvalidJsonChange(expected: Buffer, actual: Buffer): boolean {
  const expectedJson = parseJsonValue(expected);
  const actualJson = parseJsonValue(actual);

  return (
    expectedJson.valid &&
    isJsonObjectLike(expectedJson.value) &&
    !actualJson.valid
  );
}

function createJsonDiffDetails(
  expected: Buffer,
  actual: Buffer,
): SamplerValidationContentChange[] | undefined {
  const expectedJson = parseJsonValue(expected);
  const actualJson = parseJsonValue(actual);

  if (!expectedJson.valid || !actualJson.valid) {
    return undefined;
  }

  if (
    !isJsonObjectLike(expectedJson.value) ||
    !isJsonObjectLike(actualJson.value)
  ) {
    return undefined;
  }

  const expectedValue = expectedJson.value;
  const actualValue = actualJson.value;

  return diffJson(expectedValue, actualValue).map((change) =>
    mapJsonMagicChange(change, expectedValue, actualValue),
  );
}

function mapJsonMagicChange(
  change: Difference<Record<string, unknown>>,
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): SamplerValidationContentChange {
  const pointer = jsonPointerFromPath(change.path);

  if (change.type === 'add') {
    return {
      type: change.type,
      pointer,
      actual: readJsonPath(actual, change.path),
    };
  }

  if (change.type === 'delete') {
    return {
      type: change.type,
      pointer,
      expected: readJsonPath(expected, change.path),
    };
  }

  return {
    type: change.type,
    pointer,
    expected: readJsonPath(expected, change.path),
    actual: readJsonPath(actual, change.path),
  };
}

function preserveRootMetadataTimestamp(
  expectedFiles: Map<string, Buffer>,
  actualFiles: Map<string, Buffer>,
): void {
  const expected = expectedFiles.get('meta.json');
  const actual = actualFiles.get('meta.json');

  if (!expected || !actual) {
    return;
  }

  const expectedJson = parseJsonObject(expected);
  const actualJson = parseJsonObject(actual);

  if (!expectedJson || !actualJson) {
    return;
  }

  const expectedVersion = readVersionHash(expectedJson);
  const actualVersion = readVersionHash(actualJson);

  if (!expectedVersion || expectedVersion !== actualVersion) {
    return;
  }

  expectedJson.version = actualJson.version;
  expectedFiles.set('meta.json', Buffer.from(JSON.stringify(expectedJson)));
}

function readVersionHash(value: Record<string, unknown>): string | undefined {
  const version = value.version;

  if (!version || typeof version !== 'object' || Array.isArray(version)) {
    return undefined;
  }

  const hash = (version as Record<string, unknown>).version;

  return typeof hash === 'string' ? hash : undefined;
}

function parseJsonObject(buffer: Buffer): Record<string, unknown> | undefined {
  const parsed = parseJsonValue(buffer);

  if (!parsed.valid || !isJsonObject(parsed.value)) {
    return undefined;
  }

  return parsed.value;
}

function parseJsonValue(
  buffer: Buffer,
): { valid: true; value: unknown } | { valid: false } {
  try {
    return {
      valid: true,
      value: JSON.parse(buffer.toString('utf8')),
    };
  } catch {
    return { valid: false };
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isJsonObjectLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function readJsonPath(value: unknown, path: string[]): unknown {
  let current = value;

  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function jsonPointerFromPath(path: string[]): string {
  if (path.length === 0) {
    return '';
  }

  return `/${path.map(escapeJsonPointerSegment).join('/')}`;
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function bufferToText(buffer: Buffer): string {
  return buffer.toString('utf8');
}
