import type { ThymianFormatPosition } from '@thymian/core';
import {
  type Document,
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
  type Pair,
  parseDocument,
} from 'yaml';

import type { LocDocument } from './loc-mapper.js';

type Located = { value: unknown; key?: unknown };

export class YamlLocDocument implements LocDocument {
  private readonly lineCounter = new LineCounter();
  private readonly doc: Document;

  /** Throws if `text` is not valid YAML. */
  constructor(text: string) {
    this.doc = parseDocument(text, { lineCounter: this.lineCounter });
    const [error] = this.doc.errors;
    if (error) {
      throw error;
    }
  }

  valueAt(pointer: readonly string[]): unknown {
    const located = this.locate(pointer);
    if (!located) {
      return undefined;
    }
    return isNode(located.value) ? located.value.toJS(this.doc) : located.value;
  }

  keyPositionAt(pointer: readonly string[]): ThymianFormatPosition | undefined {
    const key = this.locate(pointer)?.key;
    const start = isNode(key) ? key.range?.[0] : undefined;
    if (typeof start !== 'number') {
      return undefined;
    }
    const { line, col } = this.lineCounter.linePos(start);
    return { line, column: col, offset: start };
  }

  private locate(pointer: readonly string[]): Located | undefined {
    let located: Located = { value: this.doc.contents };
    for (const segment of pointer) {
      const node = isAlias(located.value)
        ? located.value.resolve(this.doc)
        : located.value;

      if (isMap(node)) {
        const pair = (node.items as Pair[]).find(
          ({ key }) => String(isScalar(key) ? key.value : key) === segment,
        );
        if (!pair) {
          return undefined;
        }
        located = { value: pair.value, key: pair.key };
      } else if (isSeq(node)) {
        const index = Number(segment);
        if (!Number.isInteger(index) || index >= node.items.length) {
          return undefined;
        }
        located = { value: node.items[index] };
      } else {
        return undefined;
      }
    }
    return located;
  }
}
