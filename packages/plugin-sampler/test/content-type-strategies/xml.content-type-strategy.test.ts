import type { ThymianSchema } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { XmlContentTypeStrategy } from '../../src/generation/content-type-strategies/xml.content-type-strategy.js';
import { isFileContentSource } from '../../src/http-request-sample.js';

describe('XmlContentTypeStrategy', () => {
  const generator = new XmlContentTypeStrategy();

  async function xmlOf(schema: ThymianSchema): Promise<string> {
    const result = await generator.generate(schema);

    if (!isFileContentSource(result)) {
      throw new Error('expected a file content source');
    }

    return result.$buffer.toString('utf-8');
  }

  describe('closed objects', () => {
    // `additionalProperties: false` reaches the strategy as `{ not: {} }`.
    const closed: ThymianSchema = {
      type: 'object',
      properties: { astronaut_id: { type: 'integer' } },
      required: ['astronaut_id'],
      additionalProperties: { not: {} },
    };

    it('should not invent properties the schema forbids', async () => {
      const xml = await xmlOf(closed);

      expect(xml).toContain('<astronaut_id>');
      expect(xml).not.toContain('property1');
      expect(xml).not.toContain('property2');
    });

    it('should not invent properties behind a $ref', async () => {
      const xml = await xmlOf({
        $ref: '#/$defs/CrewMember',
        $defs: { CrewMember: closed },
      });

      expect(xml).toContain('<astronaut_id>');
      expect(xml).not.toContain('property1');
    });
  });
});
