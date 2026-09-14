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
 * Resolution is strictly by the run's own `thymianFormatVersion` — a report
 * can hold formats unioned from several merged inputs, so "the only entry"
 * carries no provenance and must never be attributed to a run that doesn't
 * name it (a hash-identical endpoint would render a foreign finding at the
 * wrong API otherwise). Runs missing their version are instead completed at
 * assembly time, where provenance is still known (`Thymian.finalizeWorkflow`
 * / `Thymian.reportConvert`). Returns `undefined` (never throws) on
 * malformed/unsupported serialized format data, so a single bad entry can't
 * fail an entire render.
 */
export function resolveThymianFormatForRun(
  formats: Report['thymianFormat'],
  runVersion: string | undefined,
): ThymianFormat | undefined {
  const serialized =
    runVersion !== undefined ? formats?.[runVersion] : undefined;

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

  return (location, runVersion) => {
    if (location.type !== 'thymianFormat') {
      return formatLocation(location);
    }

    // No version, no format: resolution never falls back (see
    // resolveThymianFormatForRun), so this renders the raw fallback text.
    if (runVersion === undefined) {
      return formatThymianFormatLocation(location, undefined);
    }

    let format: ThymianFormat | undefined;
    if (formatCache.has(runVersion)) {
      format = formatCache.get(runVersion);
    } else {
      format = resolveThymianFormatForRun(report.thymianFormat, runVersion);
      formatCache.set(runVersion, format);
    }

    return formatThymianFormatLocation(location, format);
  };
}
