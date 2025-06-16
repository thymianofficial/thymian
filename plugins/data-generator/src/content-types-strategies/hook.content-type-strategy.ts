import { ThymianEmitter, type ThymianSchema } from '@thymian/core';

import type { ContentTypeStrategy } from './content-type-strategy.js';

export class HookContentTypeStrategy implements ContentTypeStrategy {
  constructor(private readonly emitter: ThymianEmitter) {}

  matches(): boolean {
    return false;
  }

  async generate(contentType: string, schema: ThymianSchema): Promise<unknown> {
    return '';
  }
}
