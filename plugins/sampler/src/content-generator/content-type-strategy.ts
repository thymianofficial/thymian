import type { ThymianSchema } from '@thymian/core';

import type { ContentGeneratorResult } from './content-generator.js';

export interface ContentTypeStrategy {
  matches(contentType: string): boolean;

  generate(
    schema: ThymianSchema,
    contentType: string,
  ): Promise<ContentGeneratorResult>;
}
