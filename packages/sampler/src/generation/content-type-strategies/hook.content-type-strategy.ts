import {
  ThymianBaseError,
  ThymianEmitter,
  type ThymianSchema,
} from '@thymian/core';

import type { ContentSource } from '../../http-request-sample.js';
import type { ContentTypeStrategy } from './content-type-strategy.js';

export class HookContentTypeStrategy implements ContentTypeStrategy {
  constructor(private readonly emitter: ThymianEmitter) {}

  matches(): boolean {
    return false;
  }

  async generate(
    schema: ThymianSchema,
    contentType: string,
  ): Promise<ContentSource> {
    const content = await this.emitter.emitAction(
      'sampler.unknown-type',
      {
        schema,
        contentType,
      },
      {
        strategy: 'first',
        strict: false,
      },
    );

    if (!content) {
      throw new ThymianBaseError(
        `Cannot sample data for content type ${contentType}.`,
        {
          name: 'UnsupportedContentTypeError',
          ref: 'https://thymian.dev/references/errors/unsupported-content-type-error/',
        },
      );
    }

    return content;
  }
}
