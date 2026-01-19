import { rm } from 'node:fs/promises';

import stringify from 'fast-json-stable-stringify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readSamplesFromDir } from '../src/samples-structure/read-samples-from-dir.js';
import { samplesTreeFromThymianHttpTransaction } from '../src/samples-structure/samples-from-transactions.js';
import { traverse } from '../src/samples-structure/traverse.js';
import { writeSamplesToDir } from '../src/samples-structure/write-samples-to-dir.js';
import { createTempDir } from './utils.js';

describe('readSamplesFromDir', async () => {
  let tempDir!: string;

  beforeEach(async () => {
    tempDir = await createTempDir('thymian-read-samples-test-dir-');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should work', async () => {
    const samples = samplesTreeFromThymianHttpTransaction(
      {
        authorize: false,
        cookies: {},
        headers: {},
        method: 'get',
        origin: 'http://localhost:8080',
        path: '/status',
        pathParameters: {},
        query: {},
      },
      {
        thymianReq: {
          type: 'http-request',
          host: 'localhost',
          port: 8080,
          protocol: 'http',
          path: '/status',
          method: 'get',
          headers: {},
          queryParameters: {},
          cookies: {},
          pathParameters: {},
          mediaType: '',
          label: '',
          sourceName: 'test',
        },
        thymianReqId: '',
        thymianRes: {
          type: 'http-response',
          headers: {},
          mediaType: '',
          statusCode: 200,
          label: '',
          sourceName: 'test',
        },
        thymianResId: '',
        transaction: {
          type: 'http-transaction',
          label: '',
          sourceName: 'test',
        },
        transactionId: 'abc123',
      },
      '',
    );

    await writeSamplesToDir(
      samples,
      {},
      {
        path: tempDir,
      },
    );

    const readSamples = await readSamplesFromDir(tempDir);

    traverse(readSamples, '', (node, ctx) => {
      delete node.hooks;
      return ctx;
    });

    expect(stringify(samples)).toEqual(stringify(readSamples));
  });
});
