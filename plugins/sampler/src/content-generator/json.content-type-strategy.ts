import type { ThymianSchema } from '@thymian/core';
import { sample } from 'openapi-sampler';

import type { ContentTypeStrategy } from './content-type-strategy.js';
import type { ContentGeneratorResult } from './content-generator.js';

type SamplerSchema = Parameters<typeof sample>[0];

export class JsonContentTypeStrategy implements ContentTypeStrategy {
  matches(contentType: string): boolean {
    return /^application\/[^+]*[+]?(json);?.*/.test(contentType);
  }

  async generate(schema: ThymianSchema): Promise<ContentGeneratorResult> {
    return {
      content: sample(schema as SamplerSchema),
    };
  }
}
