import type { HttpTransaction } from '../format/edges/http-transaction.edge.js';
import type { ThymianHttpRequest } from '../format/nodes/http-request.node.js';
import type { ThymianHttpResponse } from '../format/nodes/http-response.node.js';
import { isNodeType, ThymianFormat } from '../format/thymian-format.js';
import {
  thymianHttpTransactionToString,
  thymianRequestToString,
  thymianResponseToString,
} from '../utils.js';
import type { Location, Report } from './report.js';

/**
 * Resolves report {@link Location}s to human-readable strings (e.g.
 * `POST /orders`). Single source of truth for location rendering, shared by
 * every consumer that turns a `Report` into user-facing output (markdown/CSV
 * formatters, the CLI renderer) so they can't drift from one another.
 */
export type LocationResolver = (
  location: Location,
  runVersion?: string,
) => string;

function fallbackThymianFormatLocation(
  location: Extract<Location, { type: 'thymianFormat' }>,
): string {
  return `format:${location.elementId}${location.pointer ? `#${location.pointer}` : ''}`;
}

/**
 * Render a `thymianFormat` location against an already-resolved
 * {@link ThymianFormat}, falling back to the raw `format:{elementId}` form
 * when the format is absent or the node/edge can't be resolved to an HTTP
 * request/response/transaction.
 */
export function formatThymianFormatLocation(
  location: Extract<Location, { type: 'thymianFormat' }>,
  format?: ThymianFormat,
): string {
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
    const transaction = format.getEdge<HttpTransaction>(location.elementId);
    const [source, target] = format.graph.extremities(location.elementId);
    const request = format.getNode<ThymianHttpRequest>(source);
    const response = format.getNode<ThymianHttpResponse>(target);

    if (transaction && request && response) {
      return thymianHttpTransactionToString(request, response);
    }
  } catch {
    return fallbackThymianFormatLocation(location);
  }

  return fallbackThymianFormatLocation(location);
}

/** Render any report {@link Location} (not just `thymianFormat`) to a string. */
export function formatLocation(
  location: Location,
  format?: ThymianFormat,
): string {
  switch (location.type) {
    case 'custom':
      return location.value;
    case 'file':
      return [location.path, location.line, location.column]
        .filter((part) => part !== undefined)
        .join(':');
    case 'url':
      return location.url;
    case 'thymianFormat':
      return formatThymianFormatLocation(location, format);
  }
}

/**
 * Resolve the {@link ThymianFormat} a run used, from `report.thymianFormat`.
 * Falls back to the single entry when `runVersion` is absent/unmatched and
 * there is exactly one format in the report — this guards against a producer
 * plugin forgetting to set `ToolRun.thymianFormatVersion`. Returns `undefined`
 * (never throws) on malformed/unsupported serialized format data, so a single
 * bad entry can't fail an entire render.
 */
export function resolveThymianFormatForRun(
  formats: Report['thymianFormat'],
  runVersion: string | undefined,
): ThymianFormat | undefined {
  const entries = Object.entries(formats ?? {});
  const serialized =
    runVersion !== undefined && formats?.[runVersion]
      ? formats[runVersion]
      : entries.length === 1
        ? entries[0]?.[1]
        : undefined;

  if (!serialized) {
    return undefined;
  }

  try {
    return ThymianFormat.import(serialized);
  } catch {
    return undefined;
  }
}

/**
 * Build a caching {@link LocationResolver} for a whole report: resolves and
 * caches the `ThymianFormat` per `runVersion` (via
 * {@link resolveThymianFormatForRun}) and renders locations against it (via
 * {@link formatLocation}). Suited to callers that render many locations
 * across potentially many run versions (markdown/CSV formatters).
 */
export function createLocationResolver(report: Report): LocationResolver {
  const formatCache = new Map<string, ThymianFormat | undefined>();
  const cacheKeyFor = (version: string | undefined) =>
    version ?? '\0single-entry';

  return (location, runVersion) => {
    if (location.type !== 'thymianFormat') {
      return formatLocation(location);
    }

    const cacheKey = cacheKeyFor(runVersion);
    let format: ThymianFormat | undefined;
    if (formatCache.has(cacheKey)) {
      format = formatCache.get(cacheKey);
    } else {
      format = resolveThymianFormatForRun(report.thymianFormat, runVersion);
      formatCache.set(cacheKey, format);
    }

    return formatThymianFormatLocation(location, format);
  };
}
