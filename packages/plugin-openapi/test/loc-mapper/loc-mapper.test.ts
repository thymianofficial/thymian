import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { NoopLogger } from '@thymian/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { locMapperForFile } from '../../src/loc-mapper/loc-mapper-for-file.js';

const fixtures = join(import.meta.dirname, '../fixtures/loc-mapper');

type Expected = { file: string; line: number; column: number };

const variants: {
  format: string;
  ext: string;
  expected: Record<string, Expected>;
}[] = [
  {
    format: 'YAML',
    ext: 'yaml',
    expected: {
      'get /inline': { file: 'openapi.yaml', line: 7, column: 5 },
      'post /inline-without-id': { file: 'openapi.yaml', line: 16, column: 5 },
      'get /whole': { file: 'paths/whole.yaml', line: 1, column: 1 },
      'patch /pointer': { file: 'paths/many.yaml', line: 3, column: 3 },
      'put /internal': { file: 'openapi.yaml', line: 45, column: 7 },
      'delete /chain': { file: 'paths/nested/users.yaml', line: 2, column: 1 },
      'get /siblings': { file: 'paths/many.yaml', line: 8, column: 3 },
    },
  },
  {
    format: 'JSON',
    ext: 'json',
    expected: {
      'get /inline': { file: 'openapi.json', line: 9, column: 7 },
      'post /inline-without-id': { file: 'openapi.json', line: 24, column: 7 },
      'get /whole': { file: 'paths/whole.json', line: 2, column: 3 },
      'patch /pointer': { file: 'paths/many.json', line: 4, column: 5 },
      'put /internal': { file: 'openapi.json', line: 70, column: 9 },
      'delete /chain': { file: 'paths/nested/users.json', line: 3, column: 3 },
      'get /siblings': { file: 'paths/many.json', line: 13, column: 5 },
    },
  },
];

describe.each(variants)(
  'loc mapper for a $format spec',
  ({ ext, expected }) => {
    const dir = join(fixtures, ext);
    const rootPath = join(dir, `openapi.${ext}`);

    function expectLocation(location: unknown, operation: string): void {
      const { file, line, column } = expected[operation] ?? {};
      expect(file).toBeDefined();
      expect(location).toMatchObject({
        path: join(dir, file ?? ''),
        position: { line, column },
      });
    }

    it.each([
      ['get', '/inline'],
      ['post', '/inline-without-id'],
    ])(
      'keeps the location of the root operation %s %s',
      async (method, path) => {
        const mapper = await locMapperForFile(rootPath, new NoopLogger());

        expectLocation(
          mapper.locationForOperation(path, method),
          `${method} ${path}`,
        );
      },
    );

    it.each([
      ['a whole-file ref', 'get', '/whole'],
      ['a ref with a pointer', 'patch', '/pointer'],
      ['an internal components/pathItems ref', 'put', '/internal'],
      ['a chain of refs', 'delete', '/chain'],
      ['a ref with sibling methods', 'get', '/siblings'],
    ])(
      'locates an operation behind %s on its method key',
      async (_, method, path) => {
        const mapper = await locMapperForFile(rootPath, new NoopLogger());

        expectLocation(
          mapper.locationForOperation(path, method),
          `${method} ${path}`,
        );
      },
    );

    it('does not mistake a link object operationId for the operation', async () => {
      const mapper = await locMapperForFile(rootPath, new NoopLogger());

      expectLocation(
        mapper.locationForOperation('/whole', 'get'),
        'get /whole',
      );
    });

    it.each([
      ['a cyclic chain of refs', 'get', '/cycle'],
      ['a ref to a missing file', 'get', '/missing'],
      [
        'a pointer that is not in the referenced file',
        'get',
        '/absent-pointer',
      ],
      ['a remote ref', 'get', '/remote'],
      ['a method the path item does not have', 'delete', '/whole'],
      ['a path template the spec does not have', 'get', '/unknown'],
    ])('gives no location for %s', async (_, method, path) => {
      const mapper = await locMapperForFile(rootPath, new NoopLogger());

      expect(mapper.locationForOperation(path, method)).toBeUndefined();
    });

    it('logs at debug level why a ref could not be followed', async () => {
      const logger = new NoopLogger();
      const debug = vi.spyOn(logger, 'debug');

      await locMapperForFile(rootPath, logger);

      expect(debug).toHaveBeenCalledWith(
        expect.stringContaining(`does-not-exist.${ext}`),
      );
    });
  },
);

describe('loc mapper with absolute refs', () => {
  let dir: string;
  const target = join(fixtures, 'yaml/paths/whole.yaml');

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'thymian-loc-mapper-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it.each([
    ['an absolute path', 'absolute', target],
    ['a file:// URL', 'file-url', pathToFileURL(target).href],
  ])('follows a ref given as %s', async (_, name, ref) => {
    const rootPath = join(dir, `${name}.yaml`);
    await writeFile(
      rootPath,
      `openapi: 3.1.0\npaths:\n  /whole:\n    $ref: '${ref}'\n`,
    );

    const mapper = await locMapperForFile(rootPath, new NoopLogger());

    expect(mapper.locationForOperation('/whole', 'get')).toMatchObject({
      path: target,
      position: { line: 1, column: 1 },
    });
  });

  it('gives no location when the root file is not parsable', async () => {
    const rootPath = join(dir, 'broken.yaml');
    await writeFile(rootPath, 'paths:\n  /x: [unclosed\n');

    const mapper = await locMapperForFile(rootPath, new NoopLogger());

    expect(mapper.locationForOperation('/x', 'get')).toBeUndefined();
  });
});

describe('loc mapper for the simple OpenAPI JSON fixture', () => {
  it('keeps the location of an operation in the root file', async () => {
    const openapiPath = join(fixtures, '../simple-openapi-v3_1.json');

    const mapper = await locMapperForFile(openapiPath, new NoopLogger());

    expect(mapper.locationForOperation('/hello', 'get')).toMatchObject({
      path: openapiPath,
      position: { line: 9, column: 7 },
    });
  });
});
