import {
  ThymianBaseError,
  ThymianEmitter,
  type ThymianSchema,
} from '@thymian/core';

import type { ContentGeneratorResult } from './content-generator.js';
import type { ContentTypeStrategy } from './content-type-strategy.js';

export class HookContentTypeStrategy implements ContentTypeStrategy {
  constructor(private readonly emitter: ThymianEmitter) {}

  matches(): boolean {
    return false;
  }

  async generate(
    schema: ThymianSchema,
    contentType: string
  ): Promise<ContentGeneratorResult> {
    const content = await this.emitter.emitAction(
      'sampler.unknown-type',
      {
        schema,
        contentType,
      },
      {
        strategy: 'first',
      }
    );

    if (!content) {
      throw new ThymianBaseError(
        `Cannot sample data for content type ${contentType}.`
      );
    }

    return content;
  }
}
