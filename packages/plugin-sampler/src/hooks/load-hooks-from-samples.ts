import { mergeHooks } from '../samples-structure/merge-tree.js';
import {
  type Hooks,
  nodeIsType,
  type SamplesStructure,
} from '../samples-structure/samples-tree-structure.js';
import { traverse } from '../samples-structure/traverse.js';

export function loadHooksFromSamples(
  samples: SamplesStructure,
): Map<string, Hooks> {
  const result = new Map<string, Hooks>();

  traverse<Hooks>(
    samples,
    {
      afterEachResponse: [],
      authorize: [],
      beforeEachRequest: [],
    },
    (node, hooks) => {
      let nextHooks = hooks;

      if (node.hooks) {
        nextHooks = mergeHooks(nextHooks, node.hooks);
      }

      if (nodeIsType(node, 'samples')) {
        result.set(node.meta.sourceTransaction, nextHooks);
      }

      return nextHooks;
    },
  );

  return result;
}
