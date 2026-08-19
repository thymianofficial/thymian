import {
  ThymianBaseError,
  type ThymianFormatLocation,
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
 */
function originOf(transaction: ThymianHttpTransaction): string | undefined {
  try {
    return thymianRequestToOrigin(transaction.thymianReq);
  } catch {
    return undefined;
  }
}

function describeTransaction(transaction: ThymianHttpTransaction): string {
  const origin = originOf(transaction);
  const location = locationToString(
    transaction.transaction.sourceLocation ??
      transaction.thymianReq.sourceLocation,
  );

  return (
    `Source "${transaction.transaction.sourceName}" describes it` +
    (origin ? ` at ${origin}` : '') +
    (location ? ` (${location}).` : '.')
  );
}

const CROSS_SOURCE_ADVICE =
  'A selector is host-stripped, so two sources that expose the same method, path, status and media types collide. Load the sources separately — a source-discriminator syntax does not exist.';

const SAME_SOURCE_ADVICE =
  'Both transactions come from the same source, so loading the sources separately cannot help. A selector is host-stripped and carries no query parameters or headers, so two operations in one description collide when they differ only in those — or when a server or operation-level "servers" entry re-adds a base path another operation already spells out. Give the two operations distinct paths, methods, statuses or media types.';

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
        first.transaction.sourceName === second.transaction.sourceName
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
