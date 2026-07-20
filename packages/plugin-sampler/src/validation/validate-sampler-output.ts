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
    typeArtifacts: {
      typesContent: generatedTypesToString(generatedTypes),
    },
  });

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
    // Normalize so a platform-native argument (e.g. `a\b.json` on Windows)
    // matches the `/`-joined keys used throughout the report.
    const normalizedForPath = normalizeRelativePath(forPath);
    // Only a generated (expected) artifact counts as "known" — pointing
    // `--for-path` at an on-disk-only file must surface as an unknown-path
    // usage error, not silently scope to that extra file.
    const known = expectedFiles.has(normalizedForPath);

    return {
      samplePath,
      checkedArtifacts: known ? 1 : 0,
      failures: failures.filter(
        (failure) => failure.path === normalizedForPath,
      ),
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
    return rootMetadataMismatchType(expected, actual);
  }

  if (path.endsWith('/meta.json')) {
    return 'metadata-out-of-sync';
  }

  return 'changed-artifact';
}

// The root `meta.json` is only "stale" when the format hash (`/version/version`)
// differs — that means the artifacts were generated against a different API
// format. Drift in other root fields (e.g. `types`, `transactions`) is an
// ordinary content change and should not claim the metadata is out of date.
function rootMetadataMismatchType(
  expected: Buffer,
  actual: Buffer,
): 'stale-root-metadata' | 'changed-artifact' {
  const expectedObject = parseJsonObject(expected);
  const actualObject = parseJsonObject(actual);

  if (!expectedObject || !actualObject) {
    return 'stale-root-metadata';
  }

  return readVersionHash(expectedObject) !== readVersionHash(actualObject)
    ? 'stale-root-metadata'
    : 'changed-artifact';
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
    expectedJson.valid && isJsonObject(expectedJson.value) && !actualJson.valid
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

  if (!isJsonObject(expectedJson.value) || !isJsonObject(actualJson.value)) {
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

  const expectedVersionObject = expectedJson.version;
  const actualVersionObject = actualJson.version;

  if (
    !isJsonObject(expectedVersionObject) ||
    !isJsonObject(actualVersionObject)
  ) {
    return;
  }

  // Only the timestamp is allowed to differ run-to-run; copy just that field so
  // drift in any other `version.*` field (added later) is still validated.
  expectedVersionObject.timestamp = actualVersionObject.timestamp;
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
