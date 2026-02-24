import { describe, expect, it } from 'vitest';

import {
  HttpRequest,
  HttpResponse,
  PartialBy,
  ThymianFormat,
  type ThymianHttpRequest,
  ThymianHttpResponse,
  ThymianSchema,
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

  describe('export', () => {
    it('should be robust against circular references', () => {
      const format = new ThymianFormat();
      const schema: ThymianSchema = {
        type: 'object',
        properties: {
          prop: { type: 'string' },
        },
      };
      schema.properties['circular'] = schema;
      format.addHttpTransaction(
        {
          cookies: {},
          headers: {},
          host: 'localhost',
          label: '',
          mediaType: '',
          method: 'post',
          path: '/',
          pathParameters: {},
          port: 8080,
          protocol: 'http',
          queryParameters: {},
          sourceName: '',
          type: 'http-request',
          body: schema,
        },
        {
          headers: {},
          label: '',
          mediaType: '',
          sourceName: '',
          statusCode: 0,
          type: 'http-response',
        },
        'test',
      );
      const exported = format.export();

      let serialized!: string;
      expect(() => {
        serialized = JSON.stringify(exported);
      }).not.toThrowError();

      const formatAgain = ThymianFormat.import(JSON.parse(serialized));
      const transactions = formatAgain.getThymianHttpTransactions();

      expect(transactions).toHaveLength(1);
      const expectedSchema = {
        type: 'object',
        properties: {
          prop: { type: 'string' },
        },
      };
      expectedSchema.properties['circular'] = expectedSchema;

      expect(transactions[0].thymianReq).toMatchObject({
        body: expectedSchema,
      });

      expect(serialized).toStrictEqual(JSON.stringify(formatAgain.export()));
    });
  });

  describe('addResponseToRequest', () => {
    it('should create unique response nodes for identical responses on different requests', () => {
      const format = new ThymianFormat();

      const request1: PartialBy<ThymianHttpRequest, 'label' | 'sourceName'> = {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/endpoint-a',
        method: 'get',
        headers: {},
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        mediaType: '',
      };

      const request2: PartialBy<ThymianHttpRequest, 'label' | 'sourceName'> = {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/endpoint-b',
        method: 'get',
        headers: {},
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        mediaType: '',
      };

      const identicalResponse: PartialBy<
        ThymianHttpResponse,
        'label' | 'sourceName'
      > = {
        type: 'http-response',
        headers: {},
        mediaType: '',
        statusCode: 200,
        description: 'OK',
      };

      const reqId1 = format.addRequest({ ...request1, sourceName: 'source1' });
      const reqId2 = format.addRequest({ ...request2, sourceName: 'source1' });

      const [resId1] = format.addResponseToRequest(reqId1, {
        ...identicalResponse,
        sourceName: 'source1',
      });
      const [resId2] = format.addResponseToRequest(reqId2, {
        ...identicalResponse,
        sourceName: 'source1',
      });

      // Response IDs should be different even though response content is identical
      expect(resId1).not.toBe(resId2);

      // Both response nodes should exist in the graph
      expect(format.graph.hasNode(resId1)).toBe(true);
      expect(format.graph.hasNode(resId2)).toBe(true);

      // Total nodes should be 4 (2 requests + 2 responses)
      expect(format.graph.order).toBe(4);
    });

    it('should throw error when adding response to non-existent request', () => {
      const format = new ThymianFormat();

      const response: PartialBy<ThymianHttpResponse, 'label'> = {
        type: 'http-response',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceName: 'source1',
      };

      expect(() => {
        format.addResponseToRequest('non-existent-request-id', response);
      }).toThrow();
    });

    it('should return both response ID and transaction ID', () => {
      const format = new ThymianFormat();

      const request: PartialBy<ThymianHttpRequest, 'label'> = {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/test',
        method: 'get',
        headers: {},
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        mediaType: '',
        sourceName: 'source1',
      };

      const response: PartialBy<ThymianHttpResponse, 'label'> = {
        type: 'http-response',
        headers: {},
        mediaType: '',
        statusCode: 200,
        sourceName: 'source1',
      };

      const reqId = format.addRequest(request);
      const [resId, transactionId] = format.addResponseToRequest(
        reqId,
        response,
      );

      // Should return valid IDs
      expect(typeof resId).toBe('string');
      expect(typeof transactionId).toBe('string');
      expect(resId.length).toBeGreaterThan(0);
      expect(transactionId.length).toBeGreaterThan(0);

      // Response and transaction should exist in graph
      expect(format.graph.hasNode(resId)).toBe(true);
      expect(format.graph.hasEdge(transactionId)).toBe(true);

      // Transaction should connect request to response
      const [sourceId, targetId] = format.graph.extremities(transactionId);
      expect(sourceId).toBe(reqId);
      expect(targetId).toBe(resId);
    });
  });

  describe('addHttpTransaction', () => {
    it('should create transaction using addResponseToRequest internally', () => {
      const format = new ThymianFormat();

      const request: PartialBy<ThymianHttpRequest, 'label' | 'sourceName'> = {
        type: 'http-request',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        path: '/test',
        method: 'post',
        headers: {},
        queryParameters: {},
        cookies: {},
        pathParameters: {},
        mediaType: 'application/json',
      };

      const response: PartialBy<ThymianHttpResponse, 'label' | 'sourceName'> = {
        type: 'http-response',
        headers: {},
        mediaType: 'application/json',
        statusCode: 201,
      };

      const [reqId, resId, transactionId] = format.addHttpTransaction(
        request,
        response,
        'test-source',
      );

      // All IDs should be valid
      expect(typeof reqId).toBe('string');
      expect(typeof resId).toBe('string');
      expect(typeof transactionId).toBe('string');

      // All nodes and edges should exist
      expect(format.graph.hasNode(reqId)).toBe(true);
      expect(format.graph.hasNode(resId)).toBe(true);
      expect(format.graph.hasEdge(transactionId)).toBe(true);

      // Verify the transaction connects request to response
      const transaction = format.getThymianHttpTransactionById(transactionId);
      expect(transaction).toBeDefined();
      expect(transaction?.thymianReqId).toBe(reqId);
      expect(transaction?.thymianResId).toBe(resId);
    });

    it('should properly inherit sourceName in response when using addHttpTransaction', () => {
      const format = new ThymianFormat();

      const [reqId, resId] = format.addHttpTransaction(
        transactions[0][0],
        transactions[0][1],
        'custom-source',
      );

      const req = format.getNode<ThymianHttpRequest>(reqId);
      const res = format.getNode<ThymianHttpResponse>(resId);

      expect(req?.sourceName).toBe('custom-source');
      expect(res?.sourceName).toBe('custom-source');
    });
  });
});
