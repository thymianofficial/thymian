import type { ThymianHttpRequest } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import {
  createGetRequest,
  createPostRequest,
} from '../../src/factories/http-request.factory.js';
import {
  createBadRequestResponse,
  createCreatedResponse,
  createOkResponse,
} from '../../src/factories/http-response.factory.js';
import {
  addTransaction,
  createThymianFormat,
} from '../../src/factories/thymian-format.factory.js';

describe('ThymianFormat Factory', () => {
  describe('addTransaction', () => {
    it('returns the id of the transaction it added', () => {
      const format = createThymianFormat();

      const launchesListed = addTransaction(
        format,
        createGetRequest({ path: '/launches' }),
        createOkResponse(),
      );

      expect(
        format.getThymianHttpTransactions().map((t) => t.transactionId),
      ).toEqual([launchesListed]);
    });

    it('defaults the source name', () => {
      const format = createThymianFormat();
      const request: Partial<ThymianHttpRequest> &
        Omit<ThymianHttpRequest, 'sourceName'> = createGetRequest();
      delete request.sourceName;

      const launchesListed = addTransaction(
        format,
        request,
        createOkResponse(),
      );

      expect(format.getEdge(launchesListed)).toMatchObject({
        sourceName: 'test-source',
      });
    });

    it('adds a second answer of one operation as a transaction on the same request', () => {
      const format = createThymianFormat();
      const createAstronaut = createPostRequest({ path: '/astronauts' });

      const astronautCreated = addTransaction(
        format,
        createAstronaut,
        createCreatedResponse(),
      );
      const astronautRejected = addTransaction(
        format,
        createAstronaut,
        createBadRequestResponse(),
      );

      expect(astronautRejected).not.toBe(astronautCreated);
      expect(format.graph.source(astronautRejected)).toBe(
        format.graph.source(astronautCreated),
      );
    });
  });
});
