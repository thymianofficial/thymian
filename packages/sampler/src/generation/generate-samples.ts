import type {
  ThymianEmitter,
  ThymianFormat,
  ThymianHttpTransaction,
} from '@thymian/core';

import { samplesTreeFromThymianHttpTransaction } from '../samples-structure/samples-from-transactions.js';
import type { SamplesStructure } from '../samples-structure/samples-tree-structure.js';
import { ContentSourceGenerator } from './content-source-generator.js';
import { HookContentTypeStrategy } from './content-type-strategies/hook.content-type-strategy.js';
import { ImageContentTypeStrategy } from './content-type-strategies/image.content-type-strategy.js';
import { JsonContentTypeStrategy } from './content-type-strategies/json.content-type-strategy.js';
import { PlainTextContentTypeStrategy } from './content-type-strategies/text.content-type-strategy.js';
import { XmlContentTypeStrategy } from './content-type-strategies/xml.content-type-strategy.js';
import { DefaultRequestGenerator } from './request-generators/default-request-generator.js';
import { RangeRequestGenerator } from './request-generators/range-request-generator.js';
import { UnauthorizedRequestGenerator } from './request-generators/unauthorized-request-generator.js';

export async function generateSamplesTree(
  format: ThymianFormat,
  transaction: ThymianHttpTransaction,
  emitter: ThymianEmitter,
): Promise<SamplesStructure> {
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

  return samplesTreeFromThymianHttpTransaction(
    await generator.generate(),
    transaction,
    format.toHash(),
  );
}
