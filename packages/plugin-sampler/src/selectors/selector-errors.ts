import {
  ThymianBaseError,
  type ThymianFormatLocation,
  type ThymianHttpRequest,
  type ThymianHttpTransaction,
  thymianRequestToOrigin,
} from '@thymian/core';

/**
 * The selector grammar, written the way the reference pages write it. Kept next
 * to the errors so the diagnostic and the parser cannot drift apart in wording.
 */
const SELECTOR_GRAMMAR =
  'METHOD SP path [ SP "(" requestMediaType ")" ] SP "->" SP status [ SP "(" responseMediaType ")" ]';

const SELECTOR_EXAMPLE =
  'POST /astronauts (application/json) -> 201 (application/json)';

function locationToString(
  location: ThymianFormatLocation | undefined,
): string | undefined {
  if (!location) {
    return undefined;
  }

  const file = 'path' in location ? location.path : location.uri;

  if (!location.position) {
    return file;
  }

  return `${file}:${location.position.line}:${location.position.column}`;
}

/**
 * `thymianRequestToOrigin` runs the origin through `normalizeUrl`, which throws
 * when `protocol://host:port` is not a URL — an OpenAPI `servers` entry like
 * `file:///tmp/api` leaves `host` empty. That failure must never replace the
 * diagnostic the user actually needs to read.
 *
 * `normalizeUrl` returns `url.toString()`, which appends the empty path as a
 * trailing slash. These sentences end in a period, so the slash is dropped: an
 * origin has none.
 */
function originOf(req: ThymianHttpRequest): string | undefined {
  try {
    const origin = thymianRequestToOrigin(req);

    return origin.endsWith('/') ? origin.slice(0, -1) : origin;
  } catch {
    return undefined;
  }
}

/**
 * The source pointer a diagnostic prints.
 *
 * `sourceName` is typed `string` on every node and edge but is not one at
 * runtime: `plugin-openapi` defaults it to `document.info.title`, the config
 * never requires an explicit name, and a missing `title` only warns. So it can
 * arrive `''` or `undefined`, and an unnamed source is named as such — it must
 * never render as `Source ""`, and it must never turn the diagnostic the user
 * needs into a `TypeError`.
 */
function describeSource(
  sourceName: string | undefined,
  origin: string | undefined,
  location: ThymianFormatLocation | undefined,
): string {
  const where = locationToString(location);

  return (
    (sourceName
      ? `Source "${sourceName}" describes it`
      : 'An unnamed source describes it') +
    (origin ? ` at ${origin}` : '') +
    (where ? ` (${where}).` : '.')
  );
}

/**
 * Names a transaction from its RESPONSE node, and takes the location from the
 * same producer — never from a mixture.
 *
 * Of the three carriers of a `sourceName`, the response node is the only one
 * that belongs to the description that actually declared this transaction. A
 * request node is deduped *across* sources, because `sourceName` sits in core's
 * ignored hash properties, and the transaction edge then inherits that deduped
 * name. A response node cannot be shared while a collision exists — its id is
 * derived from the request id and the response's semantic hash, so two sources
 * share it only when the whole transaction is identical, and then it merges and
 * there is nothing to collide.
 *
 * Mixing carriers is what prints source A's name over source B's file: core
 * rewrites an edge's `sourceName` but leaves the producer's `sourceLocation`
 * alone. The edge is consulted for the location only, where it is the same
 * producer's as the response node's.
 */
function describeTransaction(transaction: ThymianHttpTransaction): string {
  return describeSource(
    transaction.thymianRes.sourceName,
    originOf(transaction.thymianReq),
    transaction.thymianRes.sourceLocation ??
      transaction.transaction.sourceLocation,
  );
}

/**
 * The advice every collision gets, whichever kind it is.
 *
 * There is deliberately **no** same-source/cross-source classification. Telling
 * the two apart needs a per-specification identity, and the graph carries only a
 * source *name*: it defaults to `document.info.title` and is never required, so
 * a staging and a production description of one API — the flagship cross-source
 * cause — are indistinguishable by any name-based test, an unnamed description
 * is indistinguishable from every other unnamed one, and a request node deduped
 * across sources hands its name to an edge that never declared it.
 *
 * So the advice names both remedies without asserting which applies. The two
 * lines above it already print each transaction's source and, where the
 * description carries one, its file and position — the evidence a classifier
 * never had, handed to the one reader who can use it.
 */
const COLLISION_ADVICE = [
  'A selector is host-stripped and carries no query parameters or headers, so two transactions collide whenever they agree on method, path, status and media types — whether they come from one description or two.',
  'If the two lines above point at different documents, load those sources separately — a source-discriminator syntax does not exist.',
  'If they point at one document, give the two operations distinct paths, methods, statuses or media types.',
];

/**
 * Two transactions in the loaded format render the same selector. Fail-fast:
 * nothing is dropped, overwritten or resolved "last wins". This is the one hard
 * error at catalog build — rendering itself never rejects.
 */
export function selectorCollisionError(
  selector: string,
  first: ThymianHttpTransaction,
  second: ThymianHttpTransaction,
): ThymianBaseError {
  return new ThymianBaseError(
    `Two transactions resolve to the same selector "${selector}".`,
    {
      name: 'SelectorCollisionError',
      ref: 'https://thymian.dev/references/errors/selector-collision-error/',
      suggestions: [
        describeTransaction(first),
        describeTransaction(second),
        ...COLLISION_ADVICE,
      ],
    },
  );
}

/**
 * A well-formed selector that names no transaction in the loaded format. The
 * near-miss candidates are supplied by the catalog, which is the only thing that
 * knows what is loaded. A dangling selector is never auto-rebound to a
 * "close enough" transaction.
 */
export function unknownSelectorError(
  selector: string,
  suggestions: string[],
): ThymianBaseError {
  return new ThymianBaseError(
    `No transaction matches the selector "${selector}".`,
    {
      name: 'UnknownSelectorError',
      ref: 'https://thymian.dev/references/errors/unknown-selector-error/',
      suggestions,
    },
  );
}

/** The value is not a selector at all. */
export function malformedSelectorError(
  value: string,
  hints: string[] = [],
): ThymianBaseError {
  return new ThymianBaseError(
    `"${value}" is not a valid transaction selector.`,
    {
      name: 'MalformedSelectorError',
      ref: 'https://thymian.dev/references/errors/malformed-selector-error/',
      suggestions: [
        ...hints,
        `Write a selector as ${SELECTOR_GRAMMAR}.`,
        `For example: "${SELECTOR_EXAMPLE}".`,
      ],
    },
  );
}
