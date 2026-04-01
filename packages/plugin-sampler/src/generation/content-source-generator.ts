import type { ThymianSchema } from '@thymian/core';

import type { ContentSource } from '../http-request-sample.js';
import type { ContentTypeStrategy } from './content-type-strategies/content-type-strategy.js';
import { ErrorContentTypeStrategy } from './content-type-strategies/error.content-type-strategy.js';

export class ContentSourceGenerator {
  constructor(
    private readonly strategies: ContentTypeStrategy[],
    private readonly fallbackStrategy: ContentTypeStrategy = new ErrorContentTypeStrategy(),
  ) {}

  generate(contentType: string, schema: ThymianSchema): Promise<ContentSource> {
    const strategy =
      this.strategies.find((strategy) => strategy.matches(contentType)) ??
      this.fallbackStrategy;

    return strategy.generate(schema, contentType);
  }
}
