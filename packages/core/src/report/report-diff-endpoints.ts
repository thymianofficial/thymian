import stringify from 'safe-stable-stringify';

import type { ThymianHttpRequest } from '../format/nodes/http-request.node.js';
import type { ThymianHttpResponse } from '../format/nodes/http-response.node.js';
import {
  isEdgeType,
  isNodeType,
  ThymianFormat,
} from '../format/thymian-format.js';
import type { Report } from './report.js';
import type { SpecificationChange } from './report-diff.js';

/**
 * Endpoint matching between two report sides (#502, AC 5).
 *
 * Node ids in the Thymian format are stable content hashes, so an id alone
 * cannot distinguish "endpoint removed + endpoint added" from "endpoint
 * changed". Matching is therefore keyed on the deterministic natural key
 * `method + path` (extended by `protocol://host:port` only when the simple
 * key collides within a side): the same key on both sides with differing
 * content is one *changed* endpoint; keys present on one side only are
 * added/removed. No fuzzy matching — a path rename reads as removed+added.
 */

/** Request-node fields compared for the "how did it change" aspect list. */
const ASPECT_FIELDS = [
  'protocol',
  'host',
  'port',
  'headers',
  'queryParameters',
  'cookies',
  'pathParameters',
  'bodyRequired',
  'body',
  'mediaType',
  'encoding',
  'description',
] as const satisfies readonly (keyof ThymianHttpRequest)[];

interface EndpointEntry {
  requestId: string;
  node: ThymianHttpRequest;
  /** Response content signature -> response node id. */
  responseIdsBySignature: Map<string, string>;
  /** Response content signature -> http-transaction edge id. */
  transactionIdsBySignature: Map<string, string>;
}

export interface EndpointMatchResult {
  /** Specification changes, sorted by endpoint label then polarity. */
  changes: SpecificationChange[];
  /**
   * head element id -> base element id for every element paired across the
   * sides (request nodes, response nodes, transaction edges). Lets run-result
   * identity treat locations on a *changed* endpoint as the same location.
   */
  headToBaseElementIds: Map<string, string>;
  /** Whether the side carried at least one importable format graph. */
  baseHasFormat: boolean;
  headHasFormat: boolean;
}

/**
 * Response identity is content-based, never id-based: response node ids are
 * seeded with their request's id, so the same response under a changed
 * request gets a new id even when nothing about the response changed.
 */
function responseSignature(node: ThymianHttpResponse): string {
  return (
    stringify({
      statusCode: node.statusCode,
      mediaType: node.mediaType,
      headers: node.headers,
      schema: node.schema,
      description: node.description,
    }) ?? ''
  );
}

function simpleKey(node: ThymianHttpRequest): string {
  return `${node.method.toUpperCase()} ${node.path}`;
}

function extendedKey(node: ThymianHttpRequest): string {
  return `${node.method.toUpperCase()} ${node.protocol}://${node.host}:${node.port}${node.path}`;
}

/**
 * Collect the side's `http-request` nodes (with their linked responses) from
 * every importable serialized graph, keyed by the natural key. Graph hashes
 * are visited in sorted order and the first entry wins a residual collision,
 * so the result is deterministic. Malformed serialized graphs are skipped —
 * a single bad entry must not fail the whole diff (mirrors
 * `resolveThymianFormatForRun`'s tolerance).
 */
function collectEndpoints(formats: Report['thymianFormat']): {
  byKey: Map<string, EndpointEntry>;
  importedAny: boolean;
} {
  const raw: EndpointEntry[] = [];
  const seenRequestIds = new Set<string>();
  let importedAny = false;

  for (const hash of Object.keys(formats ?? {}).sort()) {
    let format: ThymianFormat;

    try {
      format = ThymianFormat.import(formats![hash]!);
    } catch {
      continue;
    }

    importedAny = true;

    const entriesById = new Map<string, EndpointEntry>();

    format.graph.forEachNode((nodeId, node) => {
      if (!isNodeType(node, 'http-request') || seenRequestIds.has(nodeId)) {
        return;
      }

      seenRequestIds.add(nodeId);
      entriesById.set(nodeId, {
        requestId: nodeId,
        node,
        responseIdsBySignature: new Map(),
        transactionIdsBySignature: new Map(),
      });
    });

    format.graph.forEachEdge((edgeId, edge, source, target) => {
      if (!isEdgeType(edge, 'http-transaction')) {
        return;
      }

      const entry = entriesById.get(source);
      const response = format.getNode<ThymianHttpResponse>(target);

      if (!entry || !response || !isNodeType(response, 'http-response')) {
        return;
      }

      const signature = responseSignature(response);

      if (!entry.responseIdsBySignature.has(signature)) {
        entry.responseIdsBySignature.set(signature, target);
        entry.transactionIdsBySignature.set(signature, edgeId);
      }
    });

    raw.push(...entriesById.values());
  }

  // Key assignment with collision handling: buckets whose simple key is
  // ambiguous within this side switch every member to the extended key.
  const buckets = new Map<string, EndpointEntry[]>();

  for (const entry of raw) {
    const key = simpleKey(entry.node);
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(key, [entry]);
    }
  }

  const byKey = new Map<string, EndpointEntry>();

  for (const [key, bucket] of buckets) {
    if (bucket.length === 1) {
      byKey.set(key, bucket[0]!);
      continue;
    }

    for (const entry of bucket) {
      const key2 = extendedKey(entry.node);

      // Residual collision (same method+path+host+port twice on one side):
      // first entry wins, deterministically (sorted-hash visit order above).
      if (!byKey.has(key2)) {
        byKey.set(key2, entry);
      }
    }
  }

  return { byKey, importedAny };
}

function sameAspects(base: EndpointEntry, head: EndpointEntry): string[] {
  const aspects: string[] = [];

  for (const field of ASPECT_FIELDS) {
    if (stringify(base.node[field]) !== stringify(head.node[field])) {
      aspects.push(field);
    }
  }

  const baseSignatures = [...base.responseIdsBySignature.keys()].sort();
  const headSignatures = [...head.responseIdsBySignature.keys()].sort();

  if (stringify(baseSignatures) !== stringify(headSignatures)) {
    aspects.push('responses');
  }

  return aspects;
}

function toChange(
  entry: EndpointEntry,
  change: SpecificationChange['change'],
  changedAspects?: string[],
): SpecificationChange {
  return {
    kind: 'specification',
    change,
    endpoint: simpleKey(entry.node),
    method: entry.node.method.toUpperCase(),
    path: entry.node.path,
    ...(changedAspects ? { changedAspects } : {}),
  };
}

export function matchEndpoints(
  baseFormats: Report['thymianFormat'],
  headFormats: Report['thymianFormat'],
): EndpointMatchResult {
  const { byKey: base, importedAny: baseHasFormat } =
    collectEndpoints(baseFormats);
  const { byKey: head, importedAny: headHasFormat } =
    collectEndpoints(headFormats);
  const headToBaseElementIds = new Map<string, string>();
  const changes: SpecificationChange[] = [];

  for (const [key, headEntry] of head) {
    const baseEntry = base.get(key);

    if (!baseEntry) {
      changes.push(toChange(headEntry, 'added'));
      continue;
    }

    // Paired: element ids on the head side resolve to their base
    // counterparts (requests directly, responses/transactions via content
    // signature). Identical content means identical ids — mapping those is
    // a harmless no-op.
    headToBaseElementIds.set(headEntry.requestId, baseEntry.requestId);

    for (const [
      signature,
      headResponseId,
    ] of headEntry.responseIdsBySignature) {
      const baseResponseId = baseEntry.responseIdsBySignature.get(signature);

      if (baseResponseId !== undefined) {
        headToBaseElementIds.set(headResponseId, baseResponseId);

        const headTransactionId =
          headEntry.transactionIdsBySignature.get(signature);
        const baseTransactionId =
          baseEntry.transactionIdsBySignature.get(signature);

        if (
          headTransactionId !== undefined &&
          baseTransactionId !== undefined
        ) {
          headToBaseElementIds.set(headTransactionId, baseTransactionId);
        }
      }
    }

    const aspects = sameAspects(baseEntry, headEntry);

    if (aspects.length > 0) {
      changes.push(toChange(headEntry, 'changed', aspects));
    }
  }

  for (const [key, baseEntry] of base) {
    if (!head.has(key)) {
      changes.push(toChange(baseEntry, 'removed'));
    }
  }

  changes.sort(
    (a, b) =>
      a.endpoint.localeCompare(b.endpoint) || a.change.localeCompare(b.change),
  );

  return { changes, headToBaseElementIds, baseHasFormat, headHasFormat };
}
