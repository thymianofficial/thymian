import type { ThymianFormatPosition } from '@thymian/core';
import { type Node as JsonNode, parseTree } from 'jsonc-parser';

import { LocMapper } from './loc-mapper.js';

export class JsonLocMapper extends LocMapper {
  private readonly root: JsonNode | undefined;
  private readonly lineStarts: number[];

  constructor(jsonText: string, path: string) {
    super(jsonText, path);
    this.root = parseTree(jsonText);
    this.lineStarts = JsonLocMapper.computeLineStarts(jsonText);
  }

  public positionForOperationId(
    operationId: string,
  ): ThymianFormatPosition | undefined {
    if (!this.root) {
      return undefined;
    }

    const opIdProp = this.findOperationIdProperty(this.root, operationId);
    if (!opIdProp) {
      return undefined;
    }

    const operationObject = opIdProp.parent;
    const methodProp = operationObject?.parent;
    if (methodProp && methodProp.type === 'property') {
      return this.offsetToLineCol(methodProp.offset);
    }

    return this.offsetToLineCol(opIdProp.offset);
  }

  public lineForOperationId(operationId: string): number | undefined {
    const pos = this.positionForOperationId(operationId);
    return pos ? pos.line : undefined;
  }

  private findOperationIdProperty(
    node: JsonNode,
    wanted: string,
  ): JsonNode | undefined {
    const stack: JsonNode[] = [node];
    while (stack.length) {
      const cur = stack.pop()!;
      if (
        cur.type === 'property' &&
        cur.children &&
        cur.children.length === 2
      ) {
        const [keyNode, valueNode] = cur.children;
        const keyText = this.sliceNodeText(keyNode!);
        if (JsonLocMapper.unquote(keyText) === 'operationId') {
          const valText = this.sliceNodeText(valueNode!);
          if (JsonLocMapper.unquote(valText) === wanted) {
            return cur;
          }
        }
      }
      if (cur.children) {
        stack.push(...cur.children);
      }
    }
    return undefined;
  }

  private sliceNodeText(n: JsonNode): string {
    return this.text.slice(n.offset, n.offset + n.length);
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
          : this.text.length + 1!;
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

  private static unquote(text: string): string {
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
      try {
        return JSON.parse(text);
      } catch {
        return text.slice(1, -1);
      }
    }
    return text;
  }
}
