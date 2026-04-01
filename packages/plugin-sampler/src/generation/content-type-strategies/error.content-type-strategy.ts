import { ThymianBaseError, type ThymianSchema } from '@thymian/core';

import type { ContentTypeStrategy } from './content-type-strategy.js';

export class ErrorContentTypeStrategy implements ContentTypeStrategy {
  matches(): boolean {
    return false;
  }

  generate(schema: ThymianSchema, contentType: string): never {
    throw new ThymianBaseError(
      `Cannot generate content for content type "${contentType}".`,
      {
        name: 'UnsupportedContentTypeError',
        ref: 'https://thymian.dev/references/errors/unsupported-content-type-error/',
      },
    );
  }
}
