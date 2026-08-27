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
 * `method + path`; when that simple key is ambiguous on EITHER side, both
 * sides switch to the extended key (`method + protocol://host:port + path`)
 * for that simple key — the scheme is decided jointly so a collision on one
 * side can never desynchronize the key shapes across sides (#502 review).
 * The same key on both sides with differing content is one *changed*
 * endpoint; keys present on one side only are added/removed. No fuzzy
 * matching — a path rename reads as removed+added.
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

interface ResponseSlotEntry {
  responseId: string;
  transactionId: string;
  /** Full content signature (identity of the response's exact shape). */
  signature: string;
}

interface EndpointEntry {
  requestId: string;
  node: ThymianHttpRequest;
  /**
   * Responses grouped by their stable SLOT key (`statusCode|mediaType`).
   * Pairing across sides happens per slot, so a response whose content
   * changed still pairs with its counterpart — the content delta surfaces
   * as the `responses` aspect instead of breaking the pairing (#502 review:
   * findings mostly sit on transaction edges, and an unpaired edge id turns
   * an unchanged finding into a false removed+added pair).
   */
  responseSlots: Map<string, ResponseSlotEntry[]>;
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
 * Response identity for the `responses` ASPECT is content-based, never
 * id-based: response node ids are seeded with their request's id, so the
 * same response under a changed request gets a new id even when nothing
 * about the response changed.
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

function responseSlotKey(node: ThymianHttpResponse): string {
  return `${node.statusCode}|${node.mediaType}`;
}

function simpleKey(node: ThymianHttpRequest): string {
  return `${node.method.toUpperCase()} ${node.path}`;
}

function extendedKey(node: ThymianHttpRequest): string {
  return `${node.method.toUpperCase()} ${node.protocol}://${node.host}:${node.port}${node.path}`;
}

/** Codepoint comparison — deterministic across locales/ICU builds. */
function codepointCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Collect the side's `http-request` nodes (with their linked responses) from
 * every importable serialized graph. The entry map is GLOBAL across the
 * side's graphs: when the same request node id appears in a second graph
 * (identical request, e.g. carrying additional responses), that graph's
 * `http-transaction` edges attach to the existing entry instead of being
 * dropped (#502 review). Graph hashes are visited in sorted order, so the
 * result is deterministic. Malformed serialized graphs are skipped — a
 * single bad entry must not fail the whole diff (mirrors
 * `resolveThymianFormatForRun`'s tolerance).
 */
function collectEndpoints(formats: Report['thymianFormat']): {
  entries: EndpointEntry[];
  importedAny: boolean;
} {
  const byRequestId = new Map<string, EndpointEntry>();
  let importedAny = false;

  for (const hash of Object.keys(formats ?? {}).sort()) {
    let format: ThymianFormat;

    try {
      format = ThymianFormat.import(formats![hash]!);
    } catch {
      continue;
    }

    importedAny = true;

    format.graph.forEachNode((nodeId, node) => {
      if (!isNodeType(node, 'http-request') || byRequestId.has(nodeId)) {
        return;
      }

      byRequestId.set(nodeId, {
        requestId: nodeId,
        node,
        responseSlots: new Map(),
      });
    });

    format.graph.forEachEdge((edgeId, edge, source, target) => {
      if (!isEdgeType(edge, 'http-transaction')) {
        return;
      }

      const entry = byRequestId.get(source);
      const response = format.getNode<ThymianHttpResponse>(target);

      if (!entry || !response || !isNodeType(response, 'http-response')) {
        return;
      }

      const slotKey = responseSlotKey(response);
      const signature = responseSignature(response);
      const slot = entry.responseSlots.get(slotKey) ?? [];

      // Identical response content contributes once, no matter how many
      // graphs of this side carry it.
      if (!slot.some((existing) => existing.signature === signature)) {
        slot.push({ responseId: target, transactionId: edgeId, signature });
        entry.responseSlots.set(slotKey, slot);
      }
    });
  }

  return { entries: [...byRequestId.values()], importedAny };
}

/**
 * Key one side's entries under the JOINTLY decided scheme: `ambiguousSimple`
 * holds every simple key that is ambiguous on at least one side, and those
 * keys use the extended form on BOTH sides. A residual extended-key
 * collision (same method+path+host+port twice on one side — two format
 * versions of one endpoint embedded in a merged report) keeps the first
 * entry, deterministically (sorted-hash collection order); a real
 * resolution needs version provenance the format map does not carry
 * (deferred, #502 review).
 */
function keyEntries(
  entries: EndpointEntry[],
  ambiguousSimple: ReadonlySet<string>,
): Map<string, { entry: EndpointEntry; extendedUsed: boolean }> {
  const byKey = new Map<
    string,
    { entry: EndpointEntry; extendedUsed: boolean }
  >();

  for (const entry of entries) {
    const simple = simpleKey(entry.node);
    const extendedUsed = ambiguousSimple.has(simple);
    const key = extendedUsed ? extendedKey(entry.node) : simple;

    if (!byKey.has(key)) {
      byKey.set(key, { entry, extendedUsed });
    }
  }

  return byKey;
}

function allSignatures(entry: EndpointEntry): string[] {
  return [...entry.responseSlots.values()]
    .flat()
    .map((slot) => slot.signature)
    .sort();
}

function changedAspects(base: EndpointEntry, head: EndpointEntry): string[] {
  const aspects: string[] = [];

  for (const field of ASPECT_FIELDS) {
    if (stringify(base.node[field]) !== stringify(head.node[field])) {
      aspects.push(field);
    }
  }

  if (stringify(allSignatures(base)) !== stringify(allSignatures(head))) {
    aspects.push('responses');
  }

  return aspects;
}

function toChange(
  entry: EndpointEntry,
  change: SpecificationChange['change'],
  extendedUsed: boolean,
  aspects?: string[],
): SpecificationChange {
  return {
    kind: 'specification',
    change,
    endpoint: simpleKey(entry.node),
    method: entry.node.method.toUpperCase(),
    path: entry.node.path,
    // host/port/protocol were the discriminator — without them two changes
    // of same-named endpoints on different hosts would be indistinguishable
    // in the document (#502 review).
    ...(extendedUsed
      ? {
          protocol: entry.node.protocol,
          host: entry.node.host,
          port: entry.node.port,
        }
      : {}),
    ...(aspects ? { changedAspects: aspects } : {}),
  };
}

/**
 * Pair the two entries' responses (and their transaction edges) across the
 * sides. Pairing is per SLOT (`statusCode|mediaType`): an unambiguous slot
 * pairs even when the response content changed — the change is an aspect,
 * not a new response. Ambiguous slots (several responses sharing status and
 * media type on one side) pair exact content matches only; anything beyond
 * that has no stable correspondence.
 */
function pairResponses(
  base: EndpointEntry,
  head: EndpointEntry,
  headToBase: Map<string, string>,
): void {
  for (const [slotKey, headSlot] of head.responseSlots) {
    const baseSlot = base.responseSlots.get(slotKey);

    if (!baseSlot) {
      continue;
    }

    if (headSlot.length === 1 && baseSlot.length === 1) {
      headToBase.set(headSlot[0]!.responseId, baseSlot[0]!.responseId);
      headToBase.set(headSlot[0]!.transactionId, baseSlot[0]!.transactionId);
      continue;
    }

    for (const headEntry of headSlot) {
      const match = baseSlot.find(
        (baseEntry) => baseEntry.signature === headEntry.signature,
      );

      if (match) {
        headToBase.set(headEntry.responseId, match.responseId);
        headToBase.set(headEntry.transactionId, match.transactionId);
      }
    }
  }
}

export function matchEndpoints(
  baseFormats: Report['thymianFormat'],
  headFormats: Report['thymianFormat'],
): EndpointMatchResult {
  const { entries: baseEntries, importedAny: baseHasFormat } =
    collectEndpoints(baseFormats);
  const { entries: headEntries, importedAny: headHasFormat } =
    collectEndpoints(headFormats);

  // Joint key-scheme decision (see keyEntries): a simple key is ambiguous
  // when any single side carries it more than once.
  const ambiguousSimple = new Set<string>();

  for (const entries of [baseEntries, headEntries]) {
    const perSide = new Map<string, number>();

    for (const entry of entries) {
      const simple = simpleKey(entry.node);
      const count = (perSide.get(simple) ?? 0) + 1;
      perSide.set(simple, count);

      if (count > 1) {
        ambiguousSimple.add(simple);
      }
    }
  }

  const base = keyEntries(baseEntries, ambiguousSimple);
  const head = keyEntries(headEntries, ambiguousSimple);
  const headToBaseElementIds = new Map<string, string>();
  const changes: SpecificationChange[] = [];

  for (const [key, { entry: headEntry, extendedUsed }] of head) {
    const baseKeyed = base.get(key);

    if (!baseKeyed) {
      changes.push(toChange(headEntry, 'added', extendedUsed));
      continue;
    }

    const baseEntry = baseKeyed.entry;

    // Paired: element ids on the head side resolve to their base
    // counterparts. Identical content means identical ids — mapping those
    // is a harmless no-op.
    headToBaseElementIds.set(headEntry.requestId, baseEntry.requestId);
    pairResponses(baseEntry, headEntry, headToBaseElementIds);

    const aspects = changedAspects(baseEntry, headEntry);

    if (aspects.length > 0) {
      changes.push(toChange(headEntry, 'changed', extendedUsed, aspects));
    }
  }

  for (const [key, { entry: baseEntry, extendedUsed }] of base) {
    if (!head.has(key)) {
      changes.push(toChange(baseEntry, 'removed', extendedUsed));
    }
  }

  changes.sort(
    (a, b) =>
      codepointCompare(a.endpoint, b.endpoint) ||
      codepointCompare(a.host ?? '', b.host ?? '') ||
      codepointCompare(a.change, b.change),
  );

  return { changes, headToBaseElementIds, baseHasFormat, headHasFormat };
}
