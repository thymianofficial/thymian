import type { ThymianSchema } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { JsonContentTypeStrategy } from '../../src/generation/content-type-strategies/json.content-type-strategy.js';
import { isInlineContentSource } from '../../src/http-request-sample.js';

describe('JsonContentTypeStrategy', () => {
  const generator = new JsonContentTypeStrategy();

  describe('.match()', () => {
    it('should match basic content type ', () => {
      const matchResult = generator.matches('application/json');
      expect(matchResult).toBe(true);
    });

    it('should return false for non-json content type', () => {
      const matchResult = generator.matches('application/xml');
      expect(matchResult).toBe(false);
    });
  });

  describe('.generate()', () => {
    it('should generate content based on schema', async () => {
      const schema: ThymianSchema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };
      const result = await generator.generate(schema);

      expect(result).toEqual({
        $content: {
          name: expect.stringMatching(/.*/),
        },
      });

      expect(isInlineContentSource(result)).toBeTruthy();

      if (isInlineContentSource(result)) {
        expect(typeof result.$content).toBe('object');
        expect(result.$content).toHaveProperty('name');
      }
    });

    it('should generate null for an empty schema', async () => {
      const schema: ThymianSchema = {};
      expect(await generator.generate(schema)).toMatchObject({
        $content: null,
      });
    });

    it('test', async () => {
      const schema: ThymianSchema = {
        type: 'string',
        examples: ['user1'],
      };
      expect(await generator.generate(schema)).toMatchObject({
        $content: 'user1',
      });
    });

    describe('closed objects', () => {
      // `additionalProperties: false` reaches the strategy as `{ not: {} }`.
      const closed: ThymianSchema = {
        type: 'object',
        properties: { astronaut_id: { type: 'integer' } },
        required: ['astronaut_id'],
        additionalProperties: { not: {} },
      };

      it('should not invent properties the schema forbids', async () => {
        expect(await generator.generate(closed)).toEqual({
          $content: { astronaut_id: 0 },
        });
      });

      it('should not invent properties behind a $ref', async () => {
        const schema: ThymianSchema = {
          $ref: '#/$defs/CrewMember',
          $defs: { CrewMember: closed },
        };

        expect(await generator.generate(schema)).toEqual({
          $content: { astronaut_id: 0 },
        });
      });

      it('should leave a `not: {}` outside additionalProperties alone', async () => {
        const schema: ThymianSchema = {
          type: 'object',
          properties: { a: { type: 'integer' } },
          required: ['a'],
          propertyNames: { not: {} },
        };

        expect(await generator.generate(schema)).toEqual({
          $content: { a: 0 },
        });
      });
    });

    describe('closed arrays', () => {
      // `items: false` reaches the strategy as `{ not: {} }`.
      const closed: ThymianSchema = { type: 'array', items: { not: {} } };

      it('should sample an empty array', async () => {
        expect(await generator.generate(closed)).toEqual({ $content: [] });
      });

      it('should sample an empty array behind a $ref', async () => {
        const schema: ThymianSchema = {
          $ref: '#/$defs/Nothing',
          $defs: { Nothing: closed },
        };

        expect(await generator.generate(schema)).toEqual({ $content: [] });
      });

      it('should sample a closed tuple from its prefixItems', async () => {
        const schema: ThymianSchema = {
          type: 'array',
          prefixItems: [{ type: 'string' }, { type: 'integer' }],
          items: { not: {} },
        };

        expect(await generator.generate(schema)).toEqual({
          $content: ['string', 0],
        });
      });

      it('should keep sampling elements for an items that admits values', async () => {
        const schema: ThymianSchema = {
          type: 'array',
          items: { type: 'integer' },
        };

        expect(await generator.generate(schema)).toEqual({ $content: [0] });
      });
    });
  });
});
