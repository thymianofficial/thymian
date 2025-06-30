import type { ThymianSchema } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { JsonContentTypeStrategy } from '../../src/content-types-strategies/json.content-type-strategy.js';

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
        content: {
          name: expect.stringMatching(/.*/),
        },
      });

      expect(typeof result.content).toBe('object');
      expect(result.content).toHaveProperty('name');
    });

    it('should generate null for an empty schema', async () => {
      const schema: ThymianSchema = {};
      expect(await generator.generate(schema)).toMatchObject({
        content: null,
      });
    });
  });
});
