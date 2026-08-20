import type {
  ThymianEmitter,
  ThymianFormat,
  ThymianHttpTransaction,
} from '@thymian/core';

import { samplesTreeFromThymianHttpTransaction } from '../samples-structure/samples-from-transactions.js';
import type { SamplesStructure } from '../samples-structure/samples-tree-structure.js';
import { generateRequestSampleForTransaction } from './generate-request-sample.js';

export async function generateSamplesTree(
  format: ThymianFormat,
  transaction: ThymianHttpTransaction,
  emitter: ThymianEmitter,
): Promise<SamplesStructure> {
  return samplesTreeFromThymianHttpTransaction(
    await generateRequestSampleForTransaction(format, transaction, emitter),
    transaction,
    format.toHash(),
  );
}
