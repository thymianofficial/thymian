import { describe, expect, it } from 'vitest';

import {
  HttpRequest,
  HttpResponse,
  PartialBy,
  ThymianFormat,
  type ThymianHttpRequest,
  ThymianHttpResponse,
} from '../../src';

describe('ThymianFormat', () => {
  const transactions: [
    PartialBy<ThymianHttpRequest, 'label' | 'sourceName'>,
    PartialBy<ThymianHttpResponse, 'label' | 'sourceName'>,
  ][] = [
    [
      {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/hello',
        method: 'get',
        headers: {
          'x-api-key': {
            required: true,
            schema: {
              type: 'string',
            },
            style: {
              explode: false,
              style: 'label',
            },
          },
        },
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        mediaType: '',
        label: '',
      },
      {
        type: 'http-response',
        headers: {},
        mediaType: 'text/plain',
        statusCode: 200,
      },
    ],
  ];

  it('should be identical for identical sources', () => {
    const format1 = new ThymianFormat();
    const format2 = new ThymianFormat();

    for (const transaction of transactions) {
      format1.addHttpTransaction(transaction[0], transaction[1], '');
      format2.addHttpTransaction(transaction[0], transaction[1], '');
    }

    expect(format1.export()).toMatchObject(format2.export());
  });

  it('should not be identically for different sources', () => {
    const format1 = new ThymianFormat();
    const format2 = new ThymianFormat();

    for (const transaction of transactions) {
      format1.addHttpTransaction(transaction[0], transaction[1], '');
      format2.addHttpTransaction(
        transaction[0],
        {
          ...transaction[1],
          mediaType: 'application/json',
        },
        '',
      );
    }

    expect(format1.export()).not.toMatchObject(format2.export());
  });

  it('should produce same hash for identical sources', () => {
    const format1 = new ThymianFormat();
    const format2 = new ThymianFormat();

    for (const transaction of transactions) {
      format1.addHttpTransaction(transaction[0], transaction[1], '');
      format2.addHttpTransaction(transaction[0], transaction[1], '');
    }

    expect(format1.toHash()).toBe(format2.toHash());
  });

  it('should not produce same hash for different sources', () => {
    const format1 = new ThymianFormat();
    const format2 = new ThymianFormat();

    for (const transaction of transactions) {
      format1.addHttpTransaction(transaction[0], transaction[1], '');
      format2.addHttpTransaction(
        transaction[0],
        {
          ...transaction[1],
          mediaType: 'application/json',
        },
        '',
      );
    }

    expect(format1.toHash()).not.toBe(format2.toHash());
  });

  describe('fromHttpTransactions', () => {
    it('should create a valid ThymianFormat graph for given HTTP transactions', () => {
      const transactions: [HttpRequest, HttpResponse][] = [
        [
          { origin: 'https://api.example.com', path: '/users', method: 'GET' },
          {
            statusCode: 200,
            headers: {},
            body: '[]',
            trailers: {},
            duration: 50,
          },
        ],
        [
          { origin: 'https://api.example.com', path: '/posts', method: 'POST' },
          {
            statusCode: 201,
            headers: {},
            body: '{}',
            trailers: {},
            duration: 75,
          },
        ],
      ];

      const thymianFormat = ThymianFormat.fromHttpTransactions(
        transactions,
        '',
      );
      expect(thymianFormat).toBeInstanceOf(ThymianFormat);

      const httpTransactions = thymianFormat.getThymianHttpTransactions();
      expect(httpTransactions.length).toBe(2);
    });

    it('should handle invalid transactions gracefully', () => {
      const transactions = [
        // Missing response in a transaction
        [
          { origin: 'https://api.example.com', path: '/users', method: 'GET' },
          null,
        ],
      ];

      expect(() =>
        ThymianFormat.fromHttpTransactions(
          transactions as [HttpRequest, HttpResponse][],
          '',
        ),
      ).toThrow();
    });
  });

  describe('filter', () => {
    it('should filter transactions based on expression', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        { ...transactions[0][0], method: 'get' },
        transactions[0][1],
        'source1',
      );
      format.addHttpTransaction(
        { ...transactions[0][0], method: 'post' },
        transactions[0][1],
        'source1',
      );

      const filtered = format.filter({
        type: 'method',
        method: 'get',
        kind: 'request',
      });

      expect(filtered).toBeInstanceOf(ThymianFormat);
      expect(filtered.getThymianHttpTransactions().length).toBe(1);
      expect(filtered.getThymianHttpTransactions()[0].thymianReq.method).toBe(
        'get',
      );
    });

    it('should filter using callback function', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        { ...transactions[0][0], method: 'get' },
        transactions[0][1],
        'source1',
      );
      format.addHttpTransaction(
        { ...transactions[0][0], method: 'post' },
        transactions[0][1],
        'source1',
      );

      const filtered = format.filter((transaction) => {
        return transaction.thymianReq.method === 'get';
      });

      expect(filtered.getThymianHttpTransactions().length).toBe(1);
    });

    it('should remove orphaned nodes after filtering', () => {
      const format = new ThymianFormat();
      const [reqId1] = format.addHttpTransaction(
        { ...transactions[0][0], method: 'get' },
        transactions[0][1],
        'source1',
      );
      const [reqId2] = format.addHttpTransaction(
        { ...transactions[0][0], method: 'post' },
        transactions[0][1],
        'source1',
      );

      const filtered = format.filter({
        type: 'method',
        method: 'get',
        kind: 'request',
      });

      expect(filtered.graph.hasNode(reqId1)).toBe(true);
      expect(filtered.graph.hasNode(reqId2)).toBe(false);
    });

    it('should return empty format when no transactions match', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        { ...transactions[0][0], method: 'get' },
        transactions[0][1],
        'source1',
      );

      const filtered = format.filter({
        type: 'method',
        method: 'delete',
        kind: 'request',
      });

      expect(filtered.getThymianHttpTransactions().length).toBe(0);
    });

    it('should return new ThymianFormat instance', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const filtered = format.filter({
        type: 'method',
        method: 'get',
        kind: 'request',
      });

      expect(filtered).not.toBe(format);
      expect(filtered).toBeInstanceOf(ThymianFormat);
    });
  });

  describe('getThymianHttpRequestsWithResponses', () => {
    it('should return requests with their responses', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const result = format.getThymianHttpRequestsWithResponses();

      expect(result.length).toBe(1);
      expect(result[0][0]).toMatchObject(
        expect.objectContaining({ type: 'http-request' }),
      );
      expect(result[0][1].length).toBe(1);
      expect(result[0][1][0]).toMatchObject(
        expect.objectContaining({ type: 'http-response' }),
      );
    });

    it('should include request and response IDs', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const result = format.getThymianHttpRequestsWithResponses();

      expect(result[0][2]).toBeDefined();
      expect(result[0][3]).toHaveLength(1);
      expect(typeof result[0][2]).toBe('string');
      expect(typeof result[0][3][0]).toBe('string');
    });

    it('should return empty array for empty format', () => {
      const format = new ThymianFormat();
      const result = format.getThymianHttpRequestsWithResponses();

      expect(result).toEqual([]);
    });
  });

  describe('getThymianHttpRequestsWithIds', () => {
    it('should return requests with their IDs', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const result = format.getThymianHttpRequestsWithIds();

      expect(result.length).toBe(1);
      expect(result[0][0]).toMatchObject(
        expect.objectContaining({ type: 'http-request' }),
      );
      expect(typeof result[0][1]).toBe('string');
    });

    it('should return empty array for empty format', () => {
      const format = new ThymianFormat();
      const result = format.getThymianHttpRequestsWithIds();

      expect(result).toEqual([]);
    });
  });

  describe('getThymianHttpRequests', () => {
    it('should return all HTTP requests', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );
      format.addHttpTransaction(
        { ...transactions[0][0], method: 'post' },
        transactions[0][1],
        'source1',
      );

      const result = format.getThymianHttpRequests();

      expect(result.length).toBe(2);
      result.forEach((req) => {
        expect(req.type).toBe('http-request');
      });
    });

    it('should return empty array for empty format', () => {
      const format = new ThymianFormat();
      const result = format.getThymianHttpRequests();

      expect(result).toEqual([]);
    });
  });

  describe('getThymianHttpTransactionById', () => {
    it('should return transaction by ID', () => {
      const format = new ThymianFormat();
      const [, , transactionId] = format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const result = format.getThymianHttpTransactionById(transactionId);

      expect(result).toBeDefined();
      expect(result?.transactionId).toBe(transactionId);
      expect(result?.thymianReq.type).toBe('http-request');
      expect(result?.thymianRes.type).toBe('http-response');
    });

    it('should return undefined for non-existent ID', () => {
      const format = new ThymianFormat();
      const result = format.getThymianHttpTransactionById('non-existent-id');

      expect(result).toBeUndefined();
    });
  });

  describe('toHash', () => {
    it('should generate consistent hash for same format', () => {
      const format = new ThymianFormat();
      format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const hash1 = format.toHash();
      const hash2 = format.toHash();

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different formats', () => {
      const format1 = new ThymianFormat();
      format1.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const format2 = new ThymianFormat();
      format2.addHttpTransaction(
        { ...transactions[0][0], method: 'post' },
        transactions[0][1],
        'source1',
      );

      expect(format1.toHash()).not.toBe(format2.toHash());
    });
  });

  describe('import with sourceName', () => {
    it('should set sourceName on nodes when not present in import', () => {
      const format1 = new ThymianFormat();
      format1.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'original',
      );

      const exported = format1.export();
      const format2 = ThymianFormat.import(exported, 'new-source');

      const requests = format2.getThymianHttpRequests();
      requests.forEach((req) => {
        expect(req.sourceName).toBe('original');
      });
    });

    it('should preserve existing sourceName in import', () => {
      const format1 = new ThymianFormat();
      format1.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const exported = format1.export();
      const format2 = ThymianFormat.import(exported);

      const requests = format2.getThymianHttpRequests();
      requests.forEach((req) => {
        expect(req.sourceName).toBe('source1');
      });
    });
  });

  describe('addNode with deterministic IDs', () => {
    it('should not create duplicate nodes with same content', () => {
      const format = new ThymianFormat();
      const node = {
        type: 'http-request' as const,
        host: 'localhost',
        port: 8080,
        protocol: 'http' as const,
        path: '/test',
        method: 'get',
        headers: {},
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        mediaType: '',
        label: 'GET http://localhost:8080/test',
        sourceName: 'source1',
      };

      const id1 = format.addNode(node);
      const id2 = format.addNode(node);

      expect(id1).toBe(id2);
      expect(format.graph.order).toBe(1);
    });

    it('should throw error when throwIfExists is true', () => {
      const format = new ThymianFormat();
      const node = {
        type: 'http-request' as const,
        host: 'localhost',
        port: 8080,
        protocol: 'http' as const,
        path: '/test',
        method: 'get',
        headers: {},
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        mediaType: '',
        label: 'GET http://localhost:8080/test',
        sourceName: 'source1',
      };

      format.addNode(node);

      expect(() =>
        format.addNode(node, undefined, { throwIfExists: true }),
      ).toThrow();
    });
  });

  describe('addEdge with deterministic IDs', () => {
    it('should not create duplicate edges with same content', () => {
      const format = new ThymianFormat();
      const [reqId, resId] = format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const edge = {
        type: 'http-link' as const,
        sourceName: 'source1',
      };

      const edgeId1 = format.addEdge(reqId, resId, edge);
      const edgeId2 = format.addEdge(reqId, resId, edge);

      expect(edgeId1).toBe(edgeId2);
    });

    it('should throw error when throwIfExists is true', () => {
      const format = new ThymianFormat();
      const [reqId, resId] = format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'source1',
      );

      const edge = {
        type: 'http-link' as const,
        sourceName: 'source1',
      };

      format.addEdge(reqId, resId, edge);

      expect(() =>
        format.addEdge(reqId, resId, edge, { throwIfExists: true }),
      ).toThrow();
    });
  });
});
