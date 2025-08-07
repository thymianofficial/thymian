import type { ThymianSchema } from '@thymian/core';
import { sample } from 'openapi-sampler';

import type { ContentGeneratorResult } from './content-generator.js';
import type { ContentTypeStrategy } from './content-type-strategy.js';

type SamplerSchema = Parameters<typeof sample>[0];

export class XmlContentTypeStrategy implements ContentTypeStrategy {
  matches(contentType: string): boolean {
    return /^application\/[^+]*[+]?(xml);?.*/.test(contentType);
  }

  async generate(schema: ThymianSchema): Promise<ContentGeneratorResult> {
    return {
      encoding: 'utf-8',
      ext: 'xml',
      buffer: Buffer.from(
        sample(schema as SamplerSchema, { format: 'xml' }) as string
      ),
    };
  }
}
