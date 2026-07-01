import {
  getHeader,
  httpRule,
  responseHeader,
  type RuleFnResult,
} from '@thymian/core';

export default httpRule(
  'rfc9110/etag-must-differ-for-different-content-encodings',
)
  .severity('error')
  // Static/test cannot observe this: static sees only spec-level shapes (no
  // real ETag/Content-Encoding VALUES), and in test Thymian drives a single
  // generated request per transaction, so it never sees two Content-Encoding
  // variants of the same resource to compare. Analytics CAN observe it
  // opportunistically: recorded real-client traffic often contains multiple
  // encoded/unencoded responses for the same (origin, path), which we correlate
  // in a closure below.
  .type('analytics')
  .appliesTo('origin server')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.3')
  .description(
    `Content codings are a property of the representation data. A strong entity tag for a content-encoded
    representation has to be distinct from the entity tag of an unencoded representation to prevent potential
    conflicts during cache updates and range requests.

    For example:
    - GET /resource (no encoding) -> ETag: "abc123"
    - GET /resource (gzip encoded) -> ETag: "def456" (MUST be different)

    In contrast, transfer codings (like chunked encoding) apply only during message transfer and do not
    result in distinct entity tags.

    This rule is validated opportunistically from recorded traffic: it correlates responses that share the
    same (origin, path) and a common strong ETag, and flags when those responses advertise differing
    Content-Encoding values. Weak entity tags (W/ prefix) are excluded because they only assert semantic,
    not byte-for-byte, equivalence and are therefore allowed to be shared across encodings.`,
  )
  .summary(
    'Strong ETags MUST differ between encoded and unencoded representations.',
  )
  .overrideAnalyticsRule((ctx) => {
    // Correlate across the recorded corpus: for each resource identity
    // (origin + path) map each strong opaque ETag to the set of distinct
    // Content-Encoding values observed with it. A conflict exists once the same
    // strong tag has been seen with two differing encodings.
    const seen = new Map<string, Map<string, Set<string>>>();

    const firstValue = (
      v: string | string[] | undefined,
    ): string | undefined => (Array.isArray(v) ? v[0] : v);

    const normalizeEncoding = (v: string | string[] | undefined): string => {
      const list = Array.isArray(v) ? v : v != null ? [v] : [];
      const tokens = list
        .flatMap((s) => s.split(','))
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0 && s !== 'identity');
      // Order-insensitive canonical form of the applied content codings.
      return tokens.sort().join(',');
    };

    // Consider every response carrying a (strong) ETag — NOT only those with a
    // Content-Encoding. The canonical violation is an unencoded representation
    // ("identity") sharing a strong ETag with an encoded one, so restricting to
    // responses that have Content-Encoding would miss it. Responses without a
    // Content-Encoding are treated as the unencoded ("identity") variant below.
    return ctx.validateCapturedHttpTransactions(
      responseHeader('etag'),
      (transaction, location): RuleFnResult[] => {
        const etagRaw = firstValue(
          getHeader(transaction.response.data.headers, 'etag'),
        );
        if (etagRaw == null) return [];

        const etag = etagRaw.trim();
        // Only strong entity tags carry the byte-equivalence guarantee that
        // makes sharing across encodings a violation. Skip weak tags (W/...).
        if (etag.startsWith('W/') || etag.startsWith('w/')) return [];

        const encoding = normalizeEncoding(
          getHeader(transaction.response.data.headers, 'content-encoding'),
        );
        // An empty encoding means only "identity" (or nothing) was applied;
        // treat it as the unencoded representation.
        const encodingKey = encoding.length > 0 ? encoding : 'identity';

        const resourceKey = `${transaction.request.data.origin}\n${transaction.request.data.path}`;
        let byEtag = seen.get(resourceKey);
        if (!byEtag) {
          byEtag = new Map<string, Set<string>>();
          seen.set(resourceKey, byEtag);
        }

        let encodings = byEtag.get(etag);
        if (!encodings) {
          encodings = new Set<string>();
          byEtag.set(etag, encodings);
        }

        const isNewEncoding = !encodings.has(encodingKey);
        encodings.add(encodingKey);

        // Flag the moment a strong tag is observed with a second, differing
        // Content-Encoding for the same resource.
        if (isNewEncoding && encodings.size > 1) {
          return [
            {
              location,
              violation: {
                message: `Strong ETag ${etag} is reused across differing Content-Encoding values (${[
                  ...encodings,
                ].join(
                  ', ',
                )}) for ${transaction.request.data.path}; strong entity tags MUST differ between content-encoded representations.`,
              },
              findings: [],
            },
          ];
        }

        return [];
      },
    );
  })
  .done();
