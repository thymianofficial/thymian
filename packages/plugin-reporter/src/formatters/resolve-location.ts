import type { Location, Report } from '@thymian/core';
import {
  isNodeType,
  ThymianFormat,
  thymianHttpTransactionToString,
  thymianRequestToString,
  thymianResponseToString,
} from '@thymian/core';

function fallbackThymianFormatLocation(
  location: Extract<Location, { type: 'thymianFormat' }>,
): string {
  return `format:${location.elementId}${location.pointer ? `#${location.pointer}` : ''}`;
}

/** Resolves report {@link Location}s to human-readable strings for Markdown. */
export type LocationResolver = (
  location: Location,
  runVersion?: string,
) => string;

/** Cache key used when resolving via the single-entry fallback (no real version can collide with it). */
const SINGLE_ENTRY_CACHE_KEY = '\0single-entry';

/**
 * Build a resolver that turns `thymianFormat` locations into endpoint strings
 * (e.g. `POST /orders`) by looking up `report.thymianFormat[runVersion]`.
 * Mirrors `common-cli/src/cli-report-renderer.ts`'s `formatThymianFormatLocation`
 * to keep formatter output consistent. Falls back to the raw `format:{elementId}` form
 * when there is no matching version, graph, or resolvable node/edge.
 *
 * Defensively mirrors that same file's `resolveRunFormat` single-entry
 * fallback: if `runVersion` is absent/unmatched but `report.thymianFormat`
 * has exactly one entry, that entry is used. This guards against a producer
 * plugin forgetting to set `ToolRun.thymianFormatVersion`.
 */
export function createLocationResolver(report: Report): LocationResolver {
  const formatCache = new Map<string, ThymianFormat>();

  function getFormat(version: string | undefined): ThymianFormat | undefined {
    const cacheKey = version ?? SINGLE_ENTRY_CACHE_KEY;
    const cached = formatCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const entries = Object.entries(report.thymianFormat ?? {});
    const serialized =
      version !== undefined && report.thymianFormat?.[version]
        ? report.thymianFormat[version]
        : entries.length === 1
          ? entries[0]?.[1]
          : undefined;

    if (!serialized) {
      return undefined;
    }

    const format = ThymianFormat.import(serialized);
    formatCache.set(cacheKey, format);
    return format;
  }

  return (location, runVersion) => {
    switch (location.type) {
      case 'custom':
        return location.value;
      case 'file':
        return [location.path, location.line, location.column]
          .filter((part) => part !== undefined)
          .join(':');
      case 'url':
        return location.url;
      case 'thymianFormat': {
        const format = getFormat(runVersion);
        if (!format) {
          return fallbackThymianFormatLocation(location);
        }

        if (location.elementType === 'node') {
          const node = format.getNode(location.elementId);

          if (node && isNodeType(node, 'http-request')) {
            return thymianRequestToString(node);
          }

          if (node && isNodeType(node, 'http-response')) {
            return thymianResponseToString(node);
          }

          return fallbackThymianFormatLocation(location);
        }

        try {
          const [source, target] = format.graph.extremities(location.elementId);
          const req = format.getNode(source);
          const res = format.getNode(target);

          if (
            req &&
            res &&
            isNodeType(req, 'http-request') &&
            isNodeType(res, 'http-response')
          ) {
            return thymianHttpTransactionToString(req, res);
          }
        } catch {
          return fallbackThymianFormatLocation(location);
        }

        return fallbackThymianFormatLocation(location);
      }
    }
  };
}
