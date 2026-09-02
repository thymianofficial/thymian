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
 * The one generator-selection site in the package: picks the request generator
 * that matches a transaction and produces its single sample.
 *
 * A pure function of `(format, transaction)` — the same pair always yields the
 * same sample, which is what lets the projection be rebuilt at will instead of
 * being stored.
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
