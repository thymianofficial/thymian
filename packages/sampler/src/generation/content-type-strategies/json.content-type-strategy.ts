import type { ThymianSchema } from '@thymian/core';
import { sample } from 'openapi-sampler';

import type { ContentSource } from '../../http-request-sample.js';
import type { ContentTypeStrategy } from './content-type-strategy.js';

type SamplerSchema = Parameters<typeof sample>[0];

export class JsonContentTypeStrategy implements ContentTypeStrategy {
  matches(contentType: string): boolean {
    return /^application\/[^+]*[+]?(json);?.*/.test(contentType);
  }

  async generate(schema: ThymianSchema): Promise<ContentSource> {
    return {
      $content: sample(schema as SamplerSchema),
    };
  }
}
