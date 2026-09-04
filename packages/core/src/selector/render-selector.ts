import type { ThymianHttpRequest } from '../format/nodes/http-request.node.js';
import type { ThymianHttpResponse } from '../format/nodes/http-response.node.js';
import type { ThymianHttpTransaction } from '../format/thymian-format.js';

/**
 * A fully-qualified transaction selector:
 *
 * ```
 * METHOD SP path [ SP "(" reqMediaType ")" ] SP "->" SP status [ SP "(" resMediaType ")" ]
 * ```
 *
 * ```
 * GET /launches -> 200 (application/json)
 * POST /astronauts (application/json) -> 201 (application/json)
 * DELETE /astronauts/{id} -> 204
 * ```
 *
 * A selector names exactly one Transaction. It is host-stripped, media-typed
 * and ASCII, and it is **the only spelling of a Transaction anywhere Thymian
 * writes one** (ADR-0020): check lines, test-case names, rule headings, report
 * locations and error texts all render it, so any printed transaction pastes
 * back as a hook target.
 *
 * This is a documentation alias only. `@thymian/plugin-sampler` generates the
 * typed union (`Selector = keyof Endpoints`) from the catalog, so branding the
 * runtime type here would have to be undone there.
 */
export type Selector = string;

/**
 * RFC 9110 §5.6.2 `tchar`, the character set a method is written in. Exported
 * because the sampler's parser and its near-miss hint have to agree with the
 * renderer on what a method looks like — one grammar, one character class.
 */
export const SELECTOR_METHOD_CHARS = "A-Za-z0-9!#$%&'*+.^_`|~-";

const METHOD_TOKEN = new RegExp(`^[${SELECTOR_METHOD_CHARS}]+$`);

/**
 * Renders a component the grammar cannot carry bare as a quoted string.
 *
 * Quoting rather than percent-encoding is what makes rendering **injective**.
 * Percent-encoding a raw space to `%20` cannot be told apart from a path that
 * already contained the three characters `%20`, so two distinct transactions
 * would render one selector. A bare component never begins with `"` and a
 * quoted one always does, so the two forms are disjoint and the escape is
 * reversible.
 */
function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * The path as a selector spells it.
 *
 * The leading `/` that `req.path` is not guaranteed to carry is supplied — a
 * canonicalization, not an escape: a description that declared both `launches`
 * and `/launches` declared one path twice.
 *
 * Beyond that the path is carried verbatim. Braces, parentheses, existing
 * percent-encoding, a trailing slash and an OpenAPI server base path all
 * survive. A path that contains whitespace, a `>` (whose only role here would
 * be to complete the `->` separator) or that begins with a `"` is rendered
 * quoted instead, because the bare form cannot carry those characters
 * unambiguously.
 */
export function encodePath(path: string): string {
  const withSlash = canonicalPath(path);

  return /[\s>]/.test(withSlash) || withSlash.startsWith('"')
    ? quote(withSlash)
    : withSlash;
}

/**
 * The path as everything that is not a selector spells it: the description's
 * own text, with the leading `/` it is not guaranteed to carry.
 *
 * This — not {@link encodePath} — is what a path glob is matched against and
 * what a filter compares. A glob author writes the path the description writes;
 * the selector's quoting is a property of the selector grammar and has no
 * business leaking into a filter.
 */
export function canonicalPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * The method as a selector spells it: uppercased, and quoted when it is not an
 * RFC 9110 token.
 *
 * Uppercasing is a canonicalization for the same reason the leading slash is:
 * HTTP methods are case-sensitive but a description cannot declare `get` and
 * `GET` as two operations on one path.
 */
export function encodeMethod(method: string): string {
  const upper = method.toUpperCase();

  return METHOD_TOKEN.test(upper) ? upper : quote(upper);
}

/**
 * The media type as a selector spells it.
 *
 * Rendered RFC-9110-faithfully: parameters, spacing and quoted strings survive
 * verbatim, **including a parenthesis inside a quoted string**, which the
 * parenthesized media group delimits with quote awareness rather than by
 * counting characters.
 *
 * Outside a quoted string, `\` is the escape and `(`/`)` are escaped with it. A
 * bare parenthesis is not a legal token character and a bare backslash is not
 * legal media-type syntax at all, so using them as the escape pair cannot
 * shadow anything a legal media type contains.
 *
 * A media type whose quoting is unbalanced cannot be scanned back with quote
 * awareness, so it falls back to escaping `"` as well. That form never enters
 * quote state on the way back, which keeps even a malformed media type
 * addressable instead of unrepresentable.
 */
export function encodeMediaType(mediaType: string): string {
  const quoteAware = escapeMediaType(mediaType, true);

  return quoteAware ?? escapeMediaType(mediaType, false) ?? mediaType;
}

/**
 * Escapes a media type for the parenthesized group.
 *
 * Returns `undefined` from the quote-aware pass when the input's quoting does
 * not balance, which is the signal to take the quote-blind pass instead.
 */
function escapeMediaType(
  mediaType: string,
  quoteAware: boolean,
): string | undefined {
  let out = '';
  let inQuotes = false;

  for (let i = 0; i < mediaType.length; i++) {
    const char = mediaType[i] as string;

    if (inQuotes) {
      // An RFC 9110 quoted-pair belongs to the media type's own text and is
      // carried through untouched.
      if (char === '\\' && i + 1 < mediaType.length) {
        out += char + (mediaType[i + 1] as string);
        i++;

        continue;
      }

      if (char === '"') {
        inQuotes = false;
      }

      out += char;

      continue;
    }

    if (char === '"' && quoteAware) {
      inQuotes = true;
      out += char;

      continue;
    }

    out +=
      char === '\\' || char === '(' || char === ')' || char === '"'
        ? `\\${char}`
        : char;
  }

  return inQuotes ? undefined : out;
}

/**
 * The request half of a selector: `POST /launches (application/json)`.
 *
 * A label that names only a request is this, so a request heading and a
 * response heading compose into the transaction's own selector rather than
 * being a third format (ADR-0020).
 */
export function formatRequestSelector(req: ThymianHttpRequest): string {
  const media = req.mediaType ? ` (${encodeMediaType(req.mediaType)})` : '';

  return `${encodeMethod(req.method)} ${encodePath(req.path)}${media}`;
}

/**
 * The response half of a selector: `201 (application/json)`.
 *
 * No reason phrase: it is derivable from the status code and is not part of the
 * grammar, so carrying it would put a second spelling of a Transaction back
 * (ADR-0020). Failure *detail* text may still spell one out.
 *
 * The status is `String(res.statusCode)`. `statusCode` is typed `number`, and
 * `String` is injective over the numbers a description can carry, so a loader
 * that produces a status outside `100..599` — or one that is not an integer at
 * all — still yields an addressable label rather than aborting the load.
 */
export function formatResponseSelector(res: ThymianHttpResponse): string {
  const media = res.mediaType ? ` (${encodeMediaType(res.mediaType)})` : '';

  return `${String(res.statusCode)}${media}`;
}

/**
 * Renders one `(request, response)` pair as its selector. The only code path
 * that produces a selector string.
 *
 * Media parts appear whenever the node **declares** a media type — not only
 * when it carries a body. `mediaType` is a non-optional string whose `''` means
 * "none", so a `content:` entry that declares a media type but no schema still
 * gets its own selector and its own media part.
 */
export function formatSelector(
  req: ThymianHttpRequest,
  res: ThymianHttpResponse,
): Selector {
  return `${formatRequestSelector(req)} -> ${formatResponseSelector(res)}`;
}

/** {@link formatSelector} for a whole transaction. */
export function selectorForTransaction(
  transaction: ThymianHttpTransaction,
): Selector {
  return formatSelector(transaction.thymianReq, transaction.thymianRes);
}
