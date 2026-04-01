import type { ThymianSchema } from '@thymian/core';

import type { ContentSource } from '../../http-request-sample.js';
import type { ContentTypeStrategy } from './content-type-strategy.js';

export class PlainTextContentTypeStrategy implements ContentTypeStrategy {
  matches(contentType: string): boolean {
    return /^text\/plain;?.*/.test(contentType);
  }

  async generate(schema: ThymianSchema): Promise<ContentSource> {
    return {
      $encoding: 'utf-8',
      $ext: '.txt',
      $buffer: Buffer.from(schema.examples?.[0]?.toString() || 'plain text'),
    };
  }
}
