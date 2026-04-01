import type { Node, SampleStructureMeta } from './samples-tree-structure.js';

export type PathToNodeType = Record<
  string,
  {
    type: Node['type'];
    containsSamples?: boolean;
  }
>;

export type StructureMetaOnDisc = {
  types: PathToNodeType;
  version: SampleStructureMeta;
  transactions: Record<string, string>;
};
