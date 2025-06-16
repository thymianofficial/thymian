import type { ThymianSchema } from '@thymian/core';
import { JsonDataServer } from '@thymian/json-data-generator-osx-arm64';

import type { ContentTypeStrategy } from './content-type-strategy.js';

export class JsonContentTypeStrategy implements ContentTypeStrategy {
  constructor(private readonly jsonDataServer: JsonDataServer) {}

  matches(contentType: string): boolean {
    return /^application\/[^+]*[+]?(json);?.*/.test(contentType);
  }

  async generate(contentType: string, schema: ThymianSchema): Promise<unknown> {
    // TODO
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const result = await this.jsonDataServer.request(schema);

    console.log({ result });

    return result;
  }
}
