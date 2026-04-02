import { join } from 'node:path';

import {
  isValidNodeType,
  nodeIsType,
  type SamplesStructure,
} from './samples-tree-structure.js';
import { traverse } from './traverse.js';
import { getFolderNameFromNode } from './write-samples-to-dir.js';

export function getPathTransactionId(
  id: string,
  path: string,
  samples: SamplesStructure,
): string | undefined {
  let finalPath = path;

  traverse(samples, path, (node, currentPath, prev) => {
    if (!isValidNodeType(node.type)) {
      throw new Error(`Invalid node type: ${node.type}`);
    }

    const folderName = getFolderNameFromNode(node);
    const newName = join(currentPath, folderName);

    if (
      nodeIsType(node, 'requests') &&
      nodeIsType(prev, 'samples') &&
      prev.meta.sourceTransaction === id
    ) {
      finalPath = newName;
    }

    return newName;
  });

  return finalPath === path ? undefined : finalPath;
}
