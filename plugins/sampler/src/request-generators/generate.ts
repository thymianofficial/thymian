import type { ThymianFormat, ThymianHttpTransaction } from '@thymian/core';

import type { ContentGenerator } from '../content-generator/content-generator.js';
import type { OutputWriter } from '../output-writer/output-writer.js';
import { DefaultRequestGenerator } from './default-request-generator.js';
import { RangeRequestGenerator } from './range-request-generator.js';

export async function generate(
  format: ThymianFormat,
  transaction: ThymianHttpTransaction,
  contentGenerator: ContentGenerator,
  writer: OutputWriter,
): Promise<void> {
  const generators = [
    new RangeRequestGenerator(format, transaction, contentGenerator, writer),
  ];

  const generator = generators.find((g) => g.matches());

  return (
    generator ??
    new DefaultRequestGenerator(format, transaction, contentGenerator, writer)
  ).generate();
}
