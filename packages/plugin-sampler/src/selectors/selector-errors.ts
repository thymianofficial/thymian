import {
  ThymianBaseError,
  type ThymianFormatLocation,
  type ThymianHttpRequest,
  type ThymianHttpResponse,
  type ThymianHttpTransaction,
  thymianRequestToOrigin,
} from '@thymian/core';

/**
 * The selector grammar, written the way the reference pages write it. Kept next
 * to the errors so the diagnostic and the parser can never drift apart in
 * wording.
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
 * `InvalidUrlError` when `protocol://host:port` is not a URL — an OpenAPI
 * `servers` entry like `file:///tmp/api` leaves `host` empty. That error must
 * never replace the collision the user actually needs to read.
 *
 * `normalizeUrl` returns `url.toString()`, which appends the empty path as a
 * trailing slash (`http://localhost:8080/`). These sentences end in a period,
 * so the slash is dropped: an origin has none.
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
 * The source that actually declared a transaction, most reliable part first.
 *
 * The edge's `sourceName` is the *least* reliable of the three and must never be
 * used alone: core derives it as `sourceName ?? req.sourceName`
 * (`core/src/format/thymian-format.ts:233`, and it overwrites whatever the
 * producer passed), while `sourceName` sits in `ignoredHashProperties`
 * (`:134-138`) so a request node is deduped *across* sources. Two descriptions
 * declaring the same request on the same origin therefore hang both edges off
 * source A's request node, and both edges report source A.
 *
 * The response node is the part that cannot be shared while a collision exists:
 * its id is `hash(requestId, semanticHash(res))`, so two sources share it only
 * when the whole transaction is identical — and identical transactions merge
 * into one, leaving nothing to collide.
 */
function sourceNamesOf(transaction: ThymianHttpTransaction): string[] {
  return [
    transaction.thymianRes.sourceName,
    transaction.thymianReq.sourceName,
    transaction.transaction.sourceName,
  ].filter((sourceName) => sourceName.length > 0);
}

function describeSource(
  sourceName: string,
  origin: string | undefined,
  location: ThymianFormatLocation | undefined,
): string {
  const where = locationToString(location);

  return (
    `Source "${sourceName}" describes it` +
    (origin ? ` at ${origin}` : '') +
    (where ? ` (${where}).` : '.')
  );
}

function describeTransaction(transaction: ThymianHttpTransaction): string {
  const sourceName =
    sourceNamesOf(transaction)[0] ?? transaction.transaction.sourceName;

  // Only a location that belongs to the source being named may be quoted.
  // Quoting the deduped request node's location would send a user reading about
  // source B into source A's file.
  const candidates: [string, ThymianFormatLocation | undefined][] = [
    [
      transaction.transaction.sourceName,
      transaction.transaction.sourceLocation,
    ],
    [transaction.thymianRes.sourceName, transaction.thymianRes.sourceLocation],
    [transaction.thymianReq.sourceName, transaction.thymianReq.sourceLocation],
  ];
  const location = candidates.find(
    ([name, at]) => at !== undefined && name === sourceName,
  )?.[1];

  return describeSource(sourceName, originOf(transaction.thymianReq), location);
}

/**
 * Names the source of a transaction whose *rendering* the grammar cannot
 * represent. Such a transaction has no catalog entry and no
 * `ThymianHttpTransaction` to hand — only the pair being rendered — but the
 * error aborts the whole format load, so it owes the user the same pointer to
 * the document to edit that a collision gives.
 */
export function describeRenderedTransaction(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse,
): string {
  const sourceName = res.sourceName || req.sourceName;
  const location =
    (res.sourceName === sourceName ? res.sourceLocation : undefined) ??
    (req.sourceName === sourceName ? req.sourceLocation : undefined);

  return describeSource(sourceName, originOf(req), location);
}

const CROSS_SOURCE_ADVICE =
  'A selector is host-stripped, so two sources that expose the same method, path, status and media types collide. Load the sources separately — a source-discriminator syntax does not exist.';

const SAME_SOURCE_ADVICE =
  'Both transactions come from the same source, so loading the sources separately cannot help. A selector is host-stripped and carries no query parameters or headers, so two operations in one description collide when they differ only in those — or when a server or operation-level "servers" entry re-adds a base path another operation already spells out. Give the two operations distinct paths, methods, statuses or media types.';

/**
 * The same-source advice tells the user that separating the sources cannot
 * help, so it may only be given when nothing on either transaction names a
 * second source. Any disagreement — and the response nodes disagree exactly
 * when two descriptions collide on one origin — is cross-source, which is also
 * the safe default: its advice stays true of a same-source collision, whereas
 * the same-source advice is flatly wrong of a cross-source one.
 */
function isSameSourceCollision(
  first: ThymianHttpTransaction,
  second: ThymianHttpTransaction,
): boolean {
  return (
    new Set([...sourceNamesOf(first), ...sourceNamesOf(second)]).size === 1
  );
}

/**
 * Two transactions in the loaded format render the same selector. Fail-fast:
 * nothing is dropped, overwritten or resolved "last wins".
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
        isSameSourceCollision(first, second)
          ? SAME_SOURCE_ADVICE
          : CROSS_SOURCE_ADVICE,
      ],
    },
  );
}

/**
 * A well-formed selector that names no transaction in the loaded format. The
 * near-miss candidates are supplied by the catalog, which is the only thing
 * that knows what is loaded.
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

/**
 * The value is not a selector at all — or is a rendering that could not survive
 * a round trip through the parser.
 */
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
