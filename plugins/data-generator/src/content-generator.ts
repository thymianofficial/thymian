import type { ContentTypeStrategy } from './content-types/content-type-strategy.js';
import { ThymianSchema } from '@thymian/core';

export class ContentGenerator {
  constructor(
    private readonly strategies: ContentTypeStrategy[],
    private readonly fallbackStrategy: ContentTypeStrategy
  ) {}

  generate(contentType: string, schema: ThymianSchema): Promise<unknown> {
    const strategy =
      this.strategies.find((strategy) => strategy.matches(contentType)) ??
      this.fallbackStrategy;

    return strategy.generate(contentType, schema);
  }
}
