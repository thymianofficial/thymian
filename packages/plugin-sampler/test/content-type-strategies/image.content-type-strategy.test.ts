import type { ThymianSchema } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { ImageContentTypeStrategy } from '../../src/generation/content-type-strategies/image.content-type-strategy.js';
import { isFileContentSource } from '../../src/http-request-sample.js';

describe('ImageContentTypeStrategy', () => {
  const strategy = new ImageContentTypeStrategy();
  const schema: ThymianSchema = {};

  describe('.matches()', () => {
    it.each([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/png; charset=binary',
    ])('matches image content type %s', (contentType) => {
      expect(strategy.matches(contentType)).toBe(true);
    });

    it('does not match non-image content types', () => {
      expect(strategy.matches('application/json')).toBe(false);
      expect(strategy.matches('text/plain')).toBe(false);
    });
  });

  describe('.generate()', () => {
    it('returns a PNG placeholder for image/png', async () => {
      const result = await strategy.generate(schema, 'image/png');

      expect(isFileContentSource(result)).toBe(true);
      if (!isFileContentSource(result)) {
        return;
      }

      expect(result.$encoding).toBe('base64');
      expect(result.$ext).toBe('png');
      expect(result.$buffer.length).toBeGreaterThan(0);
      // PNG signature: 89 50 4E 47
      expect([...result.$buffer.subarray(0, 4)]).toEqual([
        0x89, 0x50, 0x4e, 0x47,
      ]);
    });

    it('returns a JPEG placeholder for image/jpeg', async () => {
      const result = await strategy.generate(schema, 'image/jpeg');

      expect(isFileContentSource(result)).toBe(true);
      if (!isFileContentSource(result)) {
        return;
      }

      expect(result.$encoding).toBe('base64');
      expect(result.$ext).toBe('png');
      expect(result.$buffer.length).toBeGreaterThan(0);
      // JPEG signature: FF D8 FF
      expect([...result.$buffer.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    });
  });
});
