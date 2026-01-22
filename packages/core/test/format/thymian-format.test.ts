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
});
