import {
  ThymianEmitter,
  ThymianError,
  type ThymianSchema,
} from '@thymian/core';

import type { ContentTypeStrategy } from './content-type-strategy.js';

export class HookContentTypeStrategy implements ContentTypeStrategy {
  constructor(private readonly emitter: ThymianEmitter) {}

  matches(): boolean {
    return false;
  }

  async generate(
    schema: ThymianSchema,
    contentType: string
  ): Promise<{ content: unknown; encoding?: string }> {
    const content = await this.emitter.runHook('data-generator.unknown-type', {
      schema,
      contentType,
    });

    if (!content[0]) {
      throw new ThymianError(
        `Cannot sample data for content type ${contentType}.`
      );
    }

    return content[0];
  }
}
