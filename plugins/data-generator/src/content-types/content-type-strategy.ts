import { ThymianSchema } from '@thymian/core';

export interface ContentTypeStrategy {
  matches(contentType: string): boolean;

  generate(contentType: string, schema: ThymianSchema): Promise<unknown>;
}
