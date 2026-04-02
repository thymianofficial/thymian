import type { BaseNode } from './samples-tree-structure.js';

export function traverse<Context>(
  node: BaseNode,
  ctx: Context,
  visitor: (node: BaseNode, ctx: Context, prev: BaseNode) => Context,
  prev: BaseNode = node,
): void {
  const nextContext = visitor(node, ctx, prev);

  for (const child of node.children) {
    traverse(child, nextContext, visitor, node);
  }
}

export async function traverseAsync<Context>(
  node: BaseNode,
  ctx: Context,
  visitor: (node: BaseNode, ctx: Context) => Promise<Context> | Context,
): Promise<void> {
  const nextContext = await visitor(node, ctx);

  for (const child of node.children) {
    await traverseAsync(child, nextContext, visitor);
  }
}
