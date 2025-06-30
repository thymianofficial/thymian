import type { ThymianSchema } from '@thymian/core';
import { sample } from 'openapi-sampler';

import type { ContentTypeStrategy } from './content-type-strategy.js';

type SamplerSchema = Parameters<typeof sample>[0];

export class XmlContentTypeStrategy implements ContentTypeStrategy {
  matches(contentType: string): boolean {
    return /^application\/[^+]*[+]?(xml);?.*/.test(contentType);
  }

  async generate(
    schema: ThymianSchema
  ): Promise<{ content: unknown; encoding?: string }> {
    return {
      content: sample(schema as SamplerSchema),
    };
  }
}
