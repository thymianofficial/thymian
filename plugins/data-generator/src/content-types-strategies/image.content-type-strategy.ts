import sharp from 'sharp';

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
    return /^image\/(jpeg|png|)/.test(contentType);
  }
  async generate(contentType: string): Promise<unknown> {
    return sharp(this.randomPixelsBuffer(), {
      raw: {
        width: this.options.width,
        height: this.options.height,
        channels: 3,
      },
    })
      .png()
      .toBuffer()
      .toString();
  }

  private randomPixelsBuffer(): Buffer {
    const buffer = Buffer.alloc(this.options.height * this.options.width * 3);

    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }

    return buffer;
  }
}
