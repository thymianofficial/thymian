import type { ThymianSchema } from '@thymian/core';
import sharp from 'sharp';

import type { ContentSource } from '../../http-request-sample.js';
import type { ContentTypeStrategy } from './content-type-strategy.js';

export type ImageContentTypeStrategyOptions = {
  width: number;
  height: number;
};

export class ImageContentTypeStrategy implements ContentTypeStrategy {
  private readonly options: ImageContentTypeStrategyOptions;

  constructor(options: Partial<ImageContentTypeStrategyOptions> = {}) {
    this.options = {
      width: 256,
      height: 256,
      ...options,
    };
  }

  matches(contentType: string): boolean {
    // TODO: fill regex https://sharp.pixelplumbing.com/api-output/
    return /^image\/(jpeg|png|jpg)/i.test(contentType);
  }
  async generate(
    schema: ThymianSchema,
    contentType: string,
  ): Promise<ContentSource> {
    let content = sharp(this.randomPixelsBuffer(), {
      raw: {
        width: this.options.width,
        height: this.options.height,
        channels: 3,
      },
    });

    content = /^image\/(png)/i.test(contentType)
      ? content.png()
      : content.jpeg();

    return {
      $encoding: 'base64',
      $buffer: await content.toBuffer(),
      $ext: 'png',
    };
  }

  private randomPixelsBuffer(): Buffer {
    const buffer = Buffer.alloc(this.options.height * this.options.width * 3);

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }

    return buffer;
  }
}
