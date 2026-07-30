import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ThymianSchema } from '@thymian/core';

import type { ContentSource } from '../../http-request-sample.js';
import type { ContentTypeStrategy } from './content-type-strategy.js';

const ASSETS_DIR = join(import.meta.dirname, 'assets');

/**
 * Produces a placeholder body for image/* request bodies. The bytes come from
 * pre-generated static assets (256x256 solid colour) read from disk instead of
 * being synthesised at runtime, so the package carries no image-processing
 * dependency. The content is throwaway placeholder data, so fixed bytes are
 * behaviourally equivalent to the previous random-pixel generation.
 */
export class ImageContentTypeStrategy implements ContentTypeStrategy {
  matches(contentType: string): boolean {
    return /^image\/(jpeg|png|jpg)/i.test(contentType);
  }

  async generate(
    _schema: ThymianSchema,
    contentType: string,
  ): Promise<ContentSource> {
    const asset = /^image\/(png)/i.test(contentType)
      ? 'sample-256.png'
      : 'sample-256.jpg';

    return {
      $encoding: 'base64',
      $buffer: await readFile(join(ASSETS_DIR, asset)),
      $ext: 'png',
    };
  }
}
