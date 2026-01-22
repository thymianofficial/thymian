import type { ThymianEmitter, ThymianFormat } from '@thymian/core';

import { mergeTrees } from '../samples-structure/merge-tree.js';
import type { SamplesStructure } from '../samples-structure/samples-tree-structure.js';
import { generateSamplesTree } from './generate-samples.js';

export async function generateSamplesForThymianFormat(
  format: ThymianFormat,
  emitter: ThymianEmitter,
): Promise<SamplesStructure> {
  let samples: SamplesStructure = {
    children: [],
    meta: {
      version: format.toHash(),
      timestamp: 0,
    },
    type: 'root',
  };

  for (const t of format.getThymianHttpTransactions()) {
    const tree = await generateSamplesTree(format, t, emitter);

    samples = mergeTrees(samples, tree);
  }

  return samples;
}
