import type {
  ThymianEmitter,
  ThymianFormat,
  ThymianHttpTransaction,
} from '@thymian/core';

import type { HttpRequestSample } from '../http-request-sample.js';
import { ContentSourceGenerator } from './content-source-generator.js';
import { HookContentTypeStrategy } from './content-type-strategies/hook.content-type-strategy.js';
import { ImageContentTypeStrategy } from './content-type-strategies/image.content-type-strategy.js';
import { JsonContentTypeStrategy } from './content-type-strategies/json.content-type-strategy.js';
import { PlainTextContentTypeStrategy } from './content-type-strategies/text.content-type-strategy.js';
import { XmlContentTypeStrategy } from './content-type-strategies/xml.content-type-strategy.js';
import { DefaultRequestGenerator } from './request-generators/default-request-generator.js';
import { RangeRequestGenerator } from './request-generators/range-request-generator.js';
import { UnauthorizedRequestGenerator } from './request-generators/unauthorized-request-generator.js';

/**
 * The single generator-selection site for the whole package: picks the request
 * generator that matches a transaction and produces its one sample.
 *
 * Both callers go through here — the in-memory projection that serves
 * `core.request.sample`, and the on-disk tree that `sampler init` still writes.
 */
export async function generateRequestSampleForTransaction(
  format: ThymianFormat,
  transaction: ThymianHttpTransaction,
  emitter: ThymianEmitter,
): Promise<HttpRequestSample> {
  const contentGenerator = new ContentSourceGenerator(
    [
      new JsonContentTypeStrategy(),
      new XmlContentTypeStrategy(),
      new ImageContentTypeStrategy(),
      new PlainTextContentTypeStrategy(),
    ],
    new HookContentTypeStrategy(emitter),
  );

  const generators = [
    new RangeRequestGenerator(format, transaction, contentGenerator),
    new UnauthorizedRequestGenerator(format, transaction, contentGenerator),
  ];

  const generator =
    generators.find((g) => g.matches()) ??
    new DefaultRequestGenerator(format, transaction, contentGenerator);

  return await generator.generate();
}
