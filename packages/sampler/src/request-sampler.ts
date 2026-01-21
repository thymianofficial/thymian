import { ThymianBaseError } from '@thymian/core';

import type { HttpRequestSample } from './http-request-sample.js';
import { readSamplesFromDir } from './samples-structure/read-samples-from-dir.js';
import {
  nodeIsType,
  type SamplesNode,
  type SamplesStructure,
} from './samples-structure/samples-tree-structure.js';
import { traverse } from './samples-structure/traverse.js';
import { entryExists } from './utils.js';

export function readSamplesNodesFromTree(
  tree: SamplesStructure,
): Map<string, SamplesNode> {
  const result = new Map<string, SamplesNode>();

  traverse(tree, null, (node, ctx) => {
    if (nodeIsType(node, 'samples')) {
      result.set(node.meta.sourceTransaction, node);
    }

    return ctx;
  });

  return result;
}

export class RequestSampler {
  constructor(
    private readonly basePath: string,
    samples?: SamplesStructure,
  ) {
    if (samples) {
      this.sampleNodes = readSamplesNodesFromTree(samples);
      this.samples = samples;
      this.initialized = true;
    }
  }

  private samples!: SamplesStructure;
  private initialized = false;
  private sampleNodes: Map<string, SamplesNode> = new Map();

  version(): string {
    return this.samples.meta.version;
  }

  timestamp(): string {
    try {
      return new Date(this.samples.meta.timestamp).toISOString();
    } catch (e) {
      throw new ThymianBaseError(
        `Invalid timestamp in samples meta: ${this.samples.meta.timestamp}`,
        { cause: e },
      );
    }
  }

  async init(samples?: SamplesStructure): Promise<void> {
    if (this.initialized) return;

    if (!(await entryExists(this.basePath))) {
      return;
    }

    this.samples = samples ?? (await readSamplesFromDir(this.basePath));

    this.sampleNodes = readSamplesNodesFromTree(this.samples);

    this.initialized = true;
  }

  sampleForTransaction(transactionId: string): HttpRequestSample | undefined {
    if (!this.initialized) {
      throw new ThymianBaseError(
        'Cannot sample for transaction before @thymian/sampler was initialized.',
        {
          suggestions: ['Did you run "thymian sampler:init"?'],
          name: 'SamplerNotInitializedError',
        },
      );
    }

    const node = this.sampleNodes.get(transactionId);

    if (!node) {
      return undefined;
    }

    const { samplingStrategy } = node.meta;
    const samples = node.children
      .filter((child) => nodeIsType(child, 'requests'))
      .flatMap((child) => child.value);

    if (samplingStrategy.type === 'random') {
      const randomIndex = Math.floor(Math.random() * samples.length);
      return samples[randomIndex];
    } else if (samplingStrategy.type === 'fixed') {
      return samples[0];
    } else {
      throw new Error(`Unsupported sampling strategy ${samplingStrategy}`);
    }
  }
}
