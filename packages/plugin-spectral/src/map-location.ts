import type { Location, ThymianFormat } from '@thymian/core';

import type { SpectralResult } from './spectral-types.js';

/**
 * Does the finding's `source` refer to the node's source file? Spectral often
 * emits absolute paths while format nodes carry the path the spec was loaded
 * from — match exactly, or when one path is a `/`-suffix of the other.
 */
function sourceMatches(source: string, nodePath: string): boolean {
  return (
    source === nodePath ||
    source.endsWith(`/${nodePath}`) ||
    nodePath.endsWith(`/${source}`)
  );
}

/**
 * Best-effort mapping of a Spectral finding onto the loaded format (AC 4):
 *
 * 1. With a format and a finding `source`: the graph node from the same source
 *    file whose `sourceLocation.position` is nearest at-or-before the finding.
 *    Positions are 1-based (openapi loc-mappers); Spectral ranges are 0-based,
 *    so the finding line/column are shifted by +1 before comparing.
 * 2. Otherwise, a `file` location from `source` + the finding range,
 *    **1-based** line/column (0-based Spectral values shifted by +1).
 * 3. Without a `source`, a `custom` location from the joined `path` segments.
 *
 * The fallback chain is the contract — full resolution is genuinely
 * best-effort, never required.
 */
export function mapLocation(
  result: SpectralResult,
  format: ThymianFormat | undefined,
): Location {
  const line = result.range.start.line + 1;
  const column = result.range.start.character + 1;

  if (format && result.source) {
    const source = result.source;
    let bestId: string | undefined;
    let bestLine = 0;
    let bestColumn = 0;

    format.graph.forEachNode((id, node) => {
      const sourceLocation = (
        node as {
          sourceLocation?: {
            path?: string;
            position?: { line: number; column: number };
          };
        }
      ).sourceLocation;

      if (
        !sourceLocation?.position ||
        typeof sourceLocation.path !== 'string' ||
        !sourceMatches(source, sourceLocation.path)
      ) {
        return;
      }

      const { line: nodeLine, column: nodeColumn } = sourceLocation.position;

      const atOrBefore =
        nodeLine < line || (nodeLine === line && nodeColumn <= column);
      const nearerThanBest =
        nodeLine > bestLine ||
        (nodeLine === bestLine && nodeColumn > bestColumn);

      if (atOrBefore && (bestId === undefined || nearerThanBest)) {
        bestId = id;
        bestLine = nodeLine;
        bestColumn = nodeColumn;
      }
    });

    if (bestId !== undefined) {
      return {
        type: 'thymianFormat',
        elementType: 'node',
        elementId: bestId,
        pointer: '',
      };
    }
  }

  if (result.source) {
    return { type: 'file', path: result.source, line, column };
  }

  return {
    type: 'custom',
    value: result.path.length > 0 ? result.path.join('.') : 'unknown',
  };
}
