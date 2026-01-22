import { ThymianBaseError } from '@thymian/core';

import {
  type Hooks,
  type Node,
  nodeIsType,
  type RequestsNode,
  type SamplesStructure,
  type SourceNode,
} from './samples-tree-structure.js';

export function mergeHooks(a: Hooks | undefined, b: Hooks | undefined): Hooks {
  if (!a && !b)
    return {
      afterEachResponse: [],
      beforeEachRequest: [],
      authorize: [],
    };

  return {
    beforeEachRequest: [
      ...(a?.beforeEachRequest || []),
      ...(b?.beforeEachRequest || []),
    ],
    afterEachResponse: [
      ...(a?.afterEachResponse || []),
      ...(b?.afterEachResponse || []),
    ],
    authorize: [...(a?.authorize || []), ...(b?.authorize || [])],
  };
}

function getNodeKey(node: Node): string {
  switch (node.type) {
    case 'samples':
      return node.type + node.meta.sourceTransaction;
    case 'requests':
      return node.type;
    case 'root':
      return node.meta.version;
    case 'source':
    case 'statusCode':
    case 'path':
    case 'method':
    case 'host':
    case 'port':
    case 'pathParameter':
    case 'requestMediaType':
    case 'responseMediaType':
      return node.type + node.value;
  }
}

function mergeChildLists(as: Node[], bs: Node[]): Node[] {
  const map = new Map<string, Node>();

  for (const node of as) {
    map.set(getNodeKey(node), node);
  }

  for (const nodeB of bs) {
    const key = getNodeKey(nodeB);
    const nodeA = map.get(key);

    if (nodeA) {
      map.set(key, mergeNodes(nodeA, nodeB));
    } else {
      map.set(key, nodeB);
    }
  }

  return Array.from(map.values());
}

function mergeRequestNodes(a: RequestsNode, b: RequestsNode): RequestsNode {
  return {
    type: 'requests',
    meta: { ...a.meta, ...b.meta },
    hooks: mergeHooks(a.hooks, b.hooks),
    // just combine the lists of samples
    value: [...(a.value ?? []), ...(b.value ?? [])],
    children: [],
  };
}

export function mergeNodes(a: Node, b: Node): Node {
  if (a.type !== b.type) {
    throw new ThymianBaseError(
      `Cannot merge nodes of different types: ${a.type} vs ${b.type}`,
    );
  }

  if (nodeIsType(a, 'requests') && nodeIsType(b, 'requests')) {
    return mergeRequestNodes(a, b);
  } else if (!nodeIsType(a, 'requests') && !nodeIsType(b, 'requests')) {
    const node = {
      type: a.type,
      value: a.value,
      hooks: mergeHooks(a.hooks, b.hooks),
      children: mergeChildLists(a.children, b.children),
      meta: { ...(a.meta ?? {}), ...(b.meta ?? {}) },
    };

    if (a.meta || b.meta) {
      node.meta = { ...(a.meta ?? {}), ...(b.meta ?? {}) };
    }

    // this is VERY ugly, but it's currently the price for the type safe tree structure. We should probably refactor this later.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return node;
  } else {
    throw new Error('This should never happen: ' + a + ' ' + b);
  }
}

export function mergeTrees(
  a: SamplesStructure,
  b: SamplesStructure,
): SamplesStructure {
  if (a.meta.version !== b.meta.version) {
    throw new ThymianBaseError(
      `Cannot merge SamplesTrees with different versions: ${a.meta.version} vs ${b.meta.version}`,
    );
  }

  return {
    type: 'root',
    meta: {
      version: a.meta.version,
      timestamp: Math.max(a.meta.timestamp, b.meta.timestamp),
    },
    hooks: mergeHooks(a.hooks, b.hooks),
    // this cast is ugly, but it's the price for the type safe tree structure
    children: mergeChildLists(a.children, b.children) as SourceNode[],
  };
}
