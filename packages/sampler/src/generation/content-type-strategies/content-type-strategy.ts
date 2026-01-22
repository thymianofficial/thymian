import type { ThymianSchema } from '@thymian/core';

import type { ContentSource } from '../../http-request-sample.js';

export interface ContentTypeStrategy {
  matches(contentType: string): boolean;

  generate(schema: ThymianSchema, contentType: string): Promise<ContentSource>;
}
