import type { ThymianFormatPosition } from '@thymian/core';
import {
  findNodeAtLocation,
  getNodeValue,
  type Node as JsonNode,
  type ParseError,
  parseTree,
} from 'jsonc-parser';

import type { LocDocument } from './loc-mapper.js';

export class JsonLocDocument implements LocDocument {
  private readonly root: JsonNode;
  private readonly lineStarts: number[];

  /** Throws if `text` is not valid JSON. */
  constructor(private readonly text: string) {
    const errors: ParseError[] = [];
    const root = parseTree(text, errors);
    if (!root || errors.length > 0) {
      throw new Error('The file is not valid JSON.');
    }
    this.root = root;
    this.lineStarts = JsonLocDocument.computeLineStarts(text);
  }

  valueAt(pointer: readonly string[]): unknown {
    const node = this.nodeAt(pointer);
    return node ? getNodeValue(node) : undefined;
  }

  keyPositionAt(pointer: readonly string[]): ThymianFormatPosition | undefined {
    const property = this.nodeAt(pointer)?.parent;
    const key =
      property?.type === 'property' ? property.children?.[0] : undefined;
    return key ? this.offsetToLineCol(key.offset) : undefined;
  }

  private nodeAt(pointer: readonly string[]): JsonNode | undefined {
    let node: JsonNode | undefined = this.root;
    for (const segment of pointer) {
      // jsonc-parser indexes arrays by number and objects by string
      node =
        node.type === 'array'
          ? findNodeAtLocation(node, [Number(segment)])
          : findNodeAtLocation(node, [segment]);
      if (!node) {
        return undefined;
      }
    }
    return node;
  }

  private offsetToLineCol(offset: number): ThymianFormatPosition {
    let low = 0,
      high = this.lineStarts.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const start = this.lineStarts[mid]!;
      const nextStart =
        mid + 1 < this.lineStarts.length
          ? this.lineStarts[mid + 1]!
          : this.text.length + 1;
      if (offset < start) {
        high = mid - 1;
      } else if (offset >= nextStart) {
        low = mid + 1;
      } else {
        const line = mid + 1;
        const column = offset - start + 1;
        return { line, column, offset };
      }
    }
    return { line: 1, column: offset + 1, offset };
  }

  private static computeLineStarts(s: string): number[] {
    const starts = [0];
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      if (ch === 13) {
        if (i + 1 < s.length && s.charCodeAt(i + 1) === 10) {
          i++;
        }
        starts.push(i + 1);
      } else if (ch === 10) {
        starts.push(i + 1);
      }
    }
    return starts;
  }
}
