import type { ThymianSchema } from '@thymian/core';
import type { ContentTypeStrategy } from './content-type-strategy.js';
import sharp from 'sharp';

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
    return /^image\/(jpeg|png|)/.test(contentType);
  }
  async generate(contentType: string, schema: ThymianSchema): Promise<unknown> {
    return await sharp(this.randomPixelsBuffer(), {
      raw: {
        width: this.options.width,
        height: this.options.height,
        channels: 3,
      },
    })
      .png()
      .toFile(
        '/Users/matthias/University/2024-ma-matthias-keckl-thymian/plugins/data-generator/test/random.png'
      );
    // .toBuffer() // .toString('utf-8');
  }

  private randomPixelsBuffer(): Buffer {
    const buffer = Buffer.alloc(this.options.height * this.options.width * 3);

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }

    return buffer;
  }
}
