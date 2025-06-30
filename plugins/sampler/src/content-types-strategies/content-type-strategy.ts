import type { ThymianSchema } from '@thymian/core';

export interface ContentTypeStrategy {
  matches(contentType: string): boolean;

  generate(
    schema: ThymianSchema,
    contentType: string
  ): Promise<{ content: unknown; encoding?: string }>;
}
