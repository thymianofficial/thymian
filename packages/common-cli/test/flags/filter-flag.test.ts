import { Errors } from '@oclif/core';
import { describe, expect, it } from 'vitest';

import {
  filterFlag,
  filters,
  parseFilterExpression,
} from '../../src/flags/filter-flag.js';

describe('filter-flag', () => {
  describe('filters', () => {
    describe('method', () => {
      it('should create method filter', () => {
        const filter = filters.method('get');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('method');
      });
    });

    describe('statusCode', () => {
      it('should create statusCode filter with valid number', () => {
        const filter = filters.statusCode('200');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('statusCode');
      });

      it('should throw error for non-numeric statusCode', () => {
        expect(() => filters.statusCode('abc')).toThrow(Errors.CLIError);
        expect(() => filters.statusCode('abc')).toThrow(
          'Invalid status code: abc. Must be a number.',
        );
      });
    });

    describe('port', () => {
      it('should create port filter with valid number', () => {
        const filter = filters.port('8080');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('port');
      });

      it('should throw error for non-numeric port', () => {
        expect(() => filters.port('invalid')).toThrow(Errors.CLIError);
      });
    });

    describe('protocol', () => {
      it('should create protocol filter for http', () => {
        const filter = filters.protocol('http');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('protocol');
      });

      it('should create protocol filter for https', () => {
        const filter = filters.protocol('https');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('protocol');
      });

      it('should throw error for invalid protocol', () => {
        expect(() => filters.protocol('ftp')).toThrow(Errors.CLIError);
        expect(() => filters.protocol('ftp')).toThrow(
          "Protocol must be either 'http' or 'https', got: ftp",
        );
      });
    });

    describe('authorization', () => {
      it('should create authorization filter for true', () => {
        const filter = filters.authorization('true');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('isAuthorized');
      });

      it('should create authorization filter for false', () => {
        const filter = filters.authorization('false');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('isAuthorized');
      });

      it('should throw error for invalid authorization value', () => {
        expect(() => filters.authorization('yes')).toThrow(Errors.CLIError);
        expect(() => filters.authorization('yes')).toThrow(
          "Authorization must be either 'true' or 'false', got: yes",
        );
      });
    });

    describe('requestHeader', () => {
      it('should create requestHeader filter', () => {
        const filter = filters.requestHeader('content-type');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('requestHeader');
      });
    });

    describe('responseHeader', () => {
      it('should create responseHeader filter', () => {
        const filter = filters.responseHeader('x-rate-limit');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('responseHeader');
      });
    });

    describe('path', () => {
      it('should create path filter', () => {
        const filter = filters.path('/users');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('path');
      });
    });

    describe('origin', () => {
      it('should create origin filter', () => {
        const filter = filters.origin('http://localhost:8080');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('origin');
      });
    });

    describe('requestMediaType', () => {
      it('should create requestMediaType filter', () => {
        const filter = filters.requestMediaType('application/json');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('requestMediaType');
      });
    });

    describe('responseMediaType', () => {
      it('should create responseMediaType filter', () => {
        const filter = filters.responseMediaType('application/json');
        expect(filter).toBeDefined();
        expect(filter.type).toBe('responseMediaType');
      });
    });
  });

  describe('filterFlag', () => {
    const flag = filterFlag();

    it('should have correct metadata', () => {
      expect(flag.description).toContain('Filter transactions');
      expect(flag.multiple).toBe(true);
      expect(flag.helpValue).toBe('filter:value');
      expect(flag.charAliases).toContain('f');
    });

    describe('parse', () => {
      it('should parse valid method filter', async () => {
        const result = parseFilterExpression('method:get');
        expect(result).toBeDefined();
        expect(result.type).toBe('method');
      });

      it('should parse valid statusCode filter', async () => {
        const result = parseFilterExpression('statusCode:200');
        expect(result).toBeDefined();
        expect(result.type).toBe('statusCode');
      });

      it('should parse valid port filter', async () => {
        const result = parseFilterExpression('port:8080');
        expect(result).toBeDefined();
        expect(result.type).toBe('port');
      });

      it('should parse valid protocol filter', async () => {
        const result = parseFilterExpression('protocol:https');
        expect(result).toBeDefined();
        expect(result.type).toBe('protocol');
      });

      it('should parse valid authorization filter', async () => {
        const result = parseFilterExpression('authorization:true');
        expect(result).toBeDefined();
        expect(result.type).toBe('isAuthorized');
      });

      it('should parse origin filter with colons in value', async () => {
        const result = parseFilterExpression('origin:http://localhost:8080');
        expect(result).toBeDefined();
        expect(result.type).toBe('origin');
      });

      it('should parse requestHeader filter', async () => {
        const result = parseFilterExpression('requestHeader:content-type');

        expect(result).toBeDefined();
        expect(result.type).toBe('requestHeader');
      });

      it('should parse responseHeader filter', async () => {
        const result = parseFilterExpression('responseHeader:x-rate-limit');
        expect(result).toBeDefined();
        expect(result.type).toBe('responseHeader');
      });

      it('should parse path filter', async () => {
        const result = parseFilterExpression('path:/users');
        expect(result).toBeDefined();
        expect(result.type).toBe('path');
      });

      it('should parse requestMediaType filter', async () => {
        const result = parseFilterExpression(
          'requestMediaType:application/json',
        );
        expect(result).toBeDefined();
        expect(result.type).toBe('requestMediaType');
      });

      it('should parse responseMediaType filter', async () => {
        const result = parseFilterExpression(
          'responseMediaType:application/xml',
        );
        expect(result).toBeDefined();
        expect(result.type).toBe('responseMediaType');
      });

      it('should throw error for invalid format (missing colon)', async () => {
        expect(() => parseFilterExpression('method-get')).toThrow(
          Errors.CLIError,
        );
        expect(() => parseFilterExpression('method-get')).toThrow(
          'Invalid filter: method-get',
        );
      });

      it('should throw error for unknown filter name', async () => {
        expect(() => parseFilterExpression('unknown:value')).toThrow(
          Errors.CLIError,
        );
        expect(() => parseFilterExpression('unknown:value')).toThrow(
          'Unknown filter: unknown',
        );
      });

      it('should throw error for invalid statusCode value', async () => {
        expect(() => parseFilterExpression('statusCode:abc')).toThrow(
          Errors.CLIError,
        );
      });

      it('should throw error for invalid port value', async () => {
        expect(() => parseFilterExpression('port:notanumber')).toThrow(
          Errors.CLIError,
        );
      });

      it('should throw error for invalid protocol value', async () => {
        expect(() => parseFilterExpression('protocol:ftp')).toThrow(
          Errors.CLIError,
        );
      });

      it('should throw error for invalid authorization value', async () => {
        expect(() => parseFilterExpression('authorization:yes')).toThrow(
          Errors.CLIError,
        );
      });

      it('should handle empty value after colon', async () => {
        const result = parseFilterExpression('path:');
        expect(result).toBeDefined();
        expect(result.type).toBe('path');
      });
    });
  });
});
