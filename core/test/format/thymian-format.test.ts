import { describe, expect, it } from 'vitest';

import { HttpRequest, HttpResponse, ThymianFormat } from '../../src';

describe('ThymianFormat', () => {
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

      const thymianFormat = ThymianFormat.fromHttpTransactions(transactions);
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
          transactions as [HttpRequest, HttpResponse][]
        )
      ).toThrow();
    });
  });
});
