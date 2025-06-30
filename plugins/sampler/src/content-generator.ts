import type { ThymianSchema } from '@thymian/core';

import type { ContentTypeStrategy } from './content-types-strategies/content-type-strategy.js';

export class ContentGenerator {
  constructor(
    private readonly strategies: ContentTypeStrategy[],
    private readonly fallbackStrategy: ContentTypeStrategy
  ) {}

  generate(
    contentType: string,
    schema: ThymianSchema
  ): Promise<{ content: unknown; encoding?: string }> {
    const strategy =
      this.strategies.find((strategy) => strategy.matches(contentType)) ??
      this.fallbackStrategy;

    return strategy.generate(schema, contentType);
  }
}
