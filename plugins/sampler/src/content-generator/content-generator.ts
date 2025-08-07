import type { ThymianSchema } from '@thymian/core';

import type { ContentTypeStrategy } from './content-type-strategy.js';

export type ContentGeneratorResult =
  | {
      content: unknown;
    }
  | {
      encoding: string;
      buffer: Buffer;
      ext: string;
    };

export class ContentGenerator {
  constructor(
    private readonly strategies: ContentTypeStrategy[],
    private readonly fallbackStrategy: ContentTypeStrategy
  ) {}

  generate(
    contentType: string,
    schema: ThymianSchema
  ): Promise<ContentGeneratorResult> {
    const strategy =
      this.strategies.find((strategy) => strategy.matches(contentType)) ??
      this.fallbackStrategy;

    return strategy.generate(schema, contentType);
  }
}
