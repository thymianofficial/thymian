import type { ThymianFormatPosition } from '@thymian/core';
import {
  isMap,
  LineCounter,
  type Node,
  Pair,
  parseDocument,
  Scalar,
  YAMLMap,
} from 'yaml';

import { LocMapper } from './loc-mapper.js';

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

type HttpMethod = (typeof HTTP_METHODS)[number];

export class YamlLocMapper extends LocMapper {
  private readonly lineCounter: LineCounter;
  private readonly doc: ReturnType<typeof parseDocument>;

  constructor(text: string, path: string) {
    super(text, path);
    this.lineCounter = new LineCounter();
    this.doc = parseDocument(text, { lineCounter: this.lineCounter });
  }

  public positionForOperationId(
    operationId: string,
  ): ThymianFormatPosition | undefined {
    const pathsMap = this.getTopLevelMap('paths');
    if (!pathsMap) {
      return undefined;
    }

    for (const pathPair of pathsMap.items as Pair[]) {
      const pathKeyScalar = pathPair.key as Scalar | undefined;
      const pathVal = pathPair.value as YAMLMap | undefined;
      if (!pathKeyScalar || !isMap(pathVal)) {
        continue;
      }

      for (const methodPair of pathVal.items as Pair[]) {
        const methodKey = (methodPair.key as Scalar | undefined)?.value;
        if (
          !methodKey ||
          !HTTP_METHODS.includes(String(methodKey) as HttpMethod)
        ) {
          continue;
        }
        const opObj = methodPair.value as YAMLMap | undefined;
        if (!isMap(opObj)) {
          continue;
        }

        const opIdPair = this.findStringProperty(
          opObj,
          'operationId',
          operationId,
        );
        if (opIdPair) {
          const methodKeyNode = methodPair.key as Scalar | undefined;
          const posMethod = this.positionFromNode(methodKeyNode);
          if (posMethod) {
            return posMethod;
          }

          const opIdKeyNode = opIdPair.key as Scalar | undefined;
          const posOpId = this.positionFromNode(opIdKeyNode);
          if (posOpId) {
            return posOpId;
          }
        }
      }
    }
    return undefined;
  }

  public lineForOperationId(operationId: string): number | null {
    const pos = this.positionForOperationId(operationId);
    return pos ? pos.line : null;
  }

  private getTopLevelMap(key: string): YAMLMap | null {
    const contents = this.doc.contents;
    if (!isMap(contents)) {
      return null;
    }

    for (const p of contents.items as Pair[]) {
      const k = (p.key as Scalar | undefined)?.value;
      if (k === key && isMap(p.value)) {
        return p.value as YAMLMap;
      }
    }
    return null;
  }

  private findStringProperty(
    map: YAMLMap,
    propName: string,
    expectedValue?: string,
  ): Pair | null {
    for (const p of map.items as Pair[]) {
      const keyVal = (p.key as Scalar | undefined)?.value;
      if (keyVal !== propName) {
        continue;
      }

      if (expectedValue === undefined) {
        return p;
      }

      const valNode = p.value as Scalar | undefined;
      const valStr = valNode?.value;
      if (typeof valStr === 'string' && valStr === expectedValue) {
        return p;
      }
    }
    return null;
  }

  private positionFromNode(node?: Node | null): ThymianFormatPosition | null {
    if (!node || !Array.isArray((node as any).range)) {
      return null;
    }

    const [start] = (node as any).range as [number, number, number?];

    if (typeof start !== 'number') {
      return null;
    }

    const { line, col } = this.lineCounter.linePos(start);
    return { line, column: col, offset: start };
  }
}
