import type {
  ThymianError,
  ThymianHttpRequest,
  ThymianHttpResponse,
} from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { describe, expect, it } from 'vitest';

import {
  formatSelector,
  parseSelector,
  selectorForTransaction,
  selectorPath,
} from '../../src/selectors/selector.js';

/**
 * Captures the error a synchronous call throws so its `name` and
 * `options.suggestions` can be asserted, mirroring the `.rejects.toMatchObject`
 * style used for async errors elsewhere in the workspace.
 */
function catchError(fn: () => unknown): ThymianError {
  try {
    fn();
  } catch (error) {
    return error as ThymianError;
  }

  throw new Error('Expected the call to throw, but it returned normally.');
}

function suggestionsOf(error: ThymianError): string[] {
  return error.options.suggestions ?? [];
}

const GRAMMAR_SUGGESTION =
  'Write a selector as METHOD SP path [ SP "(" requestMediaType ")" ] SP "->" SP status [ SP "(" responseMediaType ")" ].';

describe('formatSelector', () => {
  it('renders the three specification examples byte-for-byte', () => {
    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: '/launches', mediaType: '' }),
        createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
      ),
    ).toBe('GET /launches -> 200 (application/json)');

    expect(
      formatSelector(
        createHttpRequest({
          method: 'POST',
          path: '/astronauts',
          mediaType: 'application/json',
        }),
        createHttpResponse({ statusCode: 201, mediaType: 'application/json' }),
      ),
    ).toBe('POST /astronauts (application/json) -> 201 (application/json)');

    expect(
      formatSelector(
        createHttpRequest({
          method: 'DELETE',
          path: '/astronauts/{id}',
          mediaType: '',
        }),
        createHttpResponse({ statusCode: 204, mediaType: '' }),
      ),
    ).toBe('DELETE /astronauts/{id} -> 204');
  });

  it('never renders protocol, host or port', () => {
    const selector = formatSelector(
      createHttpRequest({
        method: 'GET',
        path: '/launches',
        protocol: 'https',
        host: 'api.example.com',
        port: 8443,
        mediaType: '',
      }),
      createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
    );

    expect(selector).toBe('GET /launches -> 200 (application/json)');
    expect(selector).not.toContain('api.example.com');
    expect(selector).not.toContain('8443');
    expect(selector).not.toContain('https');
  });

  it('renders host-identical transactions from different origins identically', () => {
    const response = createHttpResponse({
      statusCode: 200,
      mediaType: 'application/json',
    });

    expect(
      formatSelector(
        createHttpRequest({ path: '/users', host: 'a.example', mediaType: '' }),
        response,
      ),
    ).toBe(
      formatSelector(
        createHttpRequest({
          path: '/users',
          host: 'b.example',
          port: 9999,
          mediaType: '',
        }),
        response,
      ),
    );
  });

  it('guarantees a leading slash on the path without otherwise touching it', () => {
    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: 'launches', mediaType: '' }),
        createHttpResponse({ statusCode: 200, mediaType: '' }),
      ),
    ).toBe('GET /launches -> 200');

    // basePath, trailing slash and percent-encoding are all emitted verbatim.
    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: '/v1/pets/', mediaType: '' }),
        createHttpResponse({ statusCode: 200, mediaType: '' }),
      ),
    ).toBe('GET /v1/pets/ -> 200');

    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: '/a%20b', mediaType: '' }),
        createHttpResponse({ statusCode: 200, mediaType: '' }),
      ),
    ).toBe('GET /a%20b -> 200');
  });

  it('never renders query parameters into the path', () => {
    const selector = formatSelector(
      createHttpRequest({
        method: 'GET',
        path: '/launches',
        mediaType: '',
        queryParameters: {
          limit: {
            schema: { type: 'number' },
            required: true,
            style: { style: 'form', explode: true },
          },
        },
      }),
      createHttpResponse({ statusCode: 200, mediaType: '' }),
    );

    expect(selector).toBe('GET /launches -> 200');
    expect(selector).not.toContain('limit');
  });

  it('uppercases a lowercase method', () => {
    expect(
      formatSelector(
        createHttpRequest({
          method: 'post',
          path: '/astronauts',
          mediaType: '',
        }),
        createHttpResponse({ statusCode: 201, mediaType: '' }),
      ),
    ).toBe('POST /astronauts -> 201');
  });

  it('gates each media part on mediaType, not on a body or schema', () => {
    // Both sides carry a media type but neither carries a body/schema.
    expect(
      formatSelector(
        createHttpRequest({
          method: 'POST',
          path: '/astronauts',
          mediaType: 'application/json',
          body: undefined,
        }),
        createHttpResponse({
          statusCode: 201,
          mediaType: 'application/json',
          schema: undefined,
        }),
      ),
    ).toBe('POST /astronauts (application/json) -> 201 (application/json)');

    // Empty media type is the "no media type" sentinel on both sides.
    expect(
      formatSelector(
        createHttpRequest({ method: 'GET', path: '/x', mediaType: '' }),
        createHttpResponse({ statusCode: 204, mediaType: '' }),
      ),
    ).toBe('GET /x -> 204');
  });

  it('keeps media type parameters verbatim', () => {
    expect(
      formatSelector(
        createHttpRequest({
          method: 'POST',
          path: '/x',
          mediaType: 'application/json; charset=utf-8',
        }),
        createHttpResponse({
          statusCode: 200,
          mediaType: 'application/vnd.Example+JSON',
        }),
      ),
    ).toBe(
      'POST /x (application/json; charset=utf-8) -> 200 (application/vnd.Example+JSON)',
    );
  });

  describe('refuses to render a selector that could not round-trip', () => {
    const response = createHttpResponse({ statusCode: 200, mediaType: '' });

    it('names the path when it carries whitespace', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/a b', mediaType: '' }),
          response,
        ),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(suggestionsOf(error)[0]).toBe(
        'The request path "/a b" contains whitespace, which a selector cannot represent.',
      );
    });

    it('names the path when a traffic-derived query string carries whitespace', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/search?q=a b', mediaType: '' }),
          response,
        ),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(suggestionsOf(error)[0]).toBe(
        'The request path "/search?q=a b" contains whitespace, which a selector cannot represent.',
      );
    });

    it('names the path when it carries the arrow separator', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/a->b', mediaType: '' }),
          response,
        ),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(suggestionsOf(error)[0]).toBe(
        'The request path "/a->b" contains "->", which a selector uses as its separator.',
      );
    });

    it('names the offending request media type', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/a', mediaType: 'application/json)' }),
          response,
        ),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(suggestionsOf(error)[0]).toBe(
        'The media type "application/json)" contains a parenthesis, which a selector uses to delimit media types.',
      );
    });

    it('names the offending response media type', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({ path: '/a', mediaType: '' }),
          createHttpResponse({ statusCode: 200, mediaType: 'text/(plain)' }),
        ),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(suggestionsOf(error)[0]).toBe(
        'The media type "text/(plain)" contains a parenthesis, which a selector uses to delimit media types.',
      );
    });

    // Regression guard for the review finding: `assertUnambiguous` used to
    // check the path and the media types but never the method or the status, so
    // a non-numeric OpenAPI response key (`responses: { OK: … }` survives
    // `n < 100 || n > 599`, both false for NaN) rendered `GET /pets -> NaN` —
    // a catalog key the grammar's `(\d+)` cannot parse back.
    it('rejects a NaN status rather than emitting an unparseable key', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({ method: 'GET', path: '/pets', mediaType: '' }),
          createHttpResponse({ statusCode: Number.NaN, mediaType: '' }),
        ),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(error.message).toBe(
        '"GET /pets -> NaN" is not a valid transaction selector.',
      );
      expect(suggestionsOf(error).join('\n')).toContain('its status ("NaN")');
      expect(() => parseSelector('GET /pets -> NaN')).toThrow();
    });

    const outOfGrammarStatuses: [string, number][] = [
      ['a negative status', -1],
      ['a fractional status', 200.5],
    ];

    it.each(outOfGrammarStatuses)('rejects %s', (_label, statusCode) => {
      expect(
        catchError(() =>
          formatSelector(
            createHttpRequest({ method: 'GET', path: '/pets', mediaType: '' }),
            createHttpResponse({ statusCode, mediaType: '' }),
          ),
        ).name,
      ).toBe('MalformedSelectorError');
    });

    it('rejects a method the grammar cannot represent', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({ method: 'GE T', path: '/pets', mediaType: '' }),
          response,
        ),
      );

      expect(error.name).toBe('MalformedSelectorError');
      expect(suggestionsOf(error).join('\n')).toContain('its method ("GE T")');
    });

    /**
     * A format-time rejection aborts the whole load, and every reachable
     * trigger is a spec key the user never typed as a status — so the abort is
     * only actionable if it says which document to edit. `SelectorCollisionError`
     * already names `sourceName` and `sourceLocation` for both sides.
     */
    it('names the source and location of the transaction it could not render', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({
            method: 'GET',
            path: '/pets',
            host: 'api.example.com',
            port: 443,
            protocol: 'https',
            mediaType: '',
            sourceName: 'petstore',
          }),
          createHttpResponse({
            statusCode: Number.NaN,
            mediaType: '',
            sourceName: 'petstore',
            sourceLocation: {
              path: 'petstore.yaml',
              position: { line: 24, column: 9, offset: 512 },
            },
          }),
        ),
      );

      expect(suggestionsOf(error)).toContain(
        'Source "petstore" describes it at https://api.example.com (petstore.yaml:24:9).',
      );
    });

    it('names the source of an unrenderable path too', () => {
      const error = catchError(() =>
        formatSelector(
          createHttpRequest({
            path: '/a b',
            mediaType: '',
            sourceName: 'traffic.har',
          }),
          createHttpResponse({
            statusCode: 200,
            mediaType: '',
            sourceName: 'traffic.har',
          }),
        ),
      );

      expect(suggestionsOf(error)[0]).toBe(
        'The request path "/a b" contains whitespace, which a selector cannot represent.',
      );
      expect(suggestionsOf(error)[1]).toContain('Source "traffic.har"');
    });

    /**
     * The backstop used to print both components unconditionally, so a
     * malformed method was answered with "a status must be a non-negative
     * integer" about a status that was already fine.
     */
    it('does not lecture about the status when the method is at fault', () => {
      const suggestions = suggestionsOf(
        catchError(() =>
          formatSelector(
            createHttpRequest({ method: 'GE T', path: '/pets', mediaType: '' }),
            response,
          ),
        ),
      ).join('\n');

      expect(suggestions).toContain('its method ("GE T")');
      expect(suggestions).not.toContain('its status');
    });

    it('does not lecture about the method when the status is at fault', () => {
      const suggestions = suggestionsOf(
        catchError(() =>
          formatSelector(
            createHttpRequest({ method: 'GET', path: '/pets', mediaType: '' }),
            createHttpResponse({ statusCode: Number.NaN, mediaType: '' }),
          ),
        ),
      ).join('\n');

      expect(suggestions).toContain('its status ("NaN")');
      expect(suggestions).not.toContain('its method');
    });

    it('accepts every RFC 9110 tchar in a method, including the backtick', () => {
      expect(
        formatSelector(
          createHttpRequest({
            method: "M-`!#$%&'*+.^_|~",
            path: '/x',
            mediaType: '',
          }),
          createHttpResponse({ statusCode: 200, mediaType: '' }),
        ),
      ).toBe("M-`!#$%&'*+.^_|~ /x -> 200");
    });
  });

  it('emits a traffic-derived query string verbatim when it is unambiguous', () => {
    expect(
      formatSelector(
        createHttpRequest({
          method: 'GET',
          path: '/search?q=apollo',
          mediaType: '',
        }),
        createHttpResponse({ statusCode: 200, mediaType: '' }),
      ),
    ).toBe('GET /search?q=apollo -> 200');
  });
});

describe('selectorForTransaction', () => {
  it('renders from the transaction request/response pair', () => {
    const format = createThymianFormatWithTransactions(1);
    const [transaction] = format.getThymianHttpTransactions();

    if (!transaction) {
      throw new Error('Fixture produced no transaction.');
    }

    expect(selectorForTransaction(transaction)).toBe(
      'GET /transaction-0 -> 200 (application/json)',
    );
  });
});

describe('parseSelector', () => {
  /**
   * Deliberately not `createThymianFormatWithTransactions`: that fixture emits
   * one shape only, with request `mediaType: ''` and an already-slashed path,
   * so a round trip over it stays green even if the request-media rendering or
   * the leading-slash normalization is deleted.
   */
  const roundTripCases: [string, ThymianHttpRequest, ThymianHttpResponse][] = [
    [
      'response media only',
      createHttpRequest({ method: 'GET', path: '/launches', mediaType: '' }),
      createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
    ],
    [
      'both media parts',
      createHttpRequest({
        method: 'POST',
        path: '/astronauts',
        mediaType: 'application/json',
      }),
      createHttpResponse({ statusCode: 201, mediaType: 'application/json' }),
    ],
    [
      'request media only, templated path',
      createHttpRequest({
        method: 'PUT',
        path: '/astronauts/{id}',
        mediaType: 'application/xml',
      }),
      createHttpResponse({ statusCode: 200, mediaType: '' }),
    ],
    [
      'neither media part',
      createHttpRequest({ method: 'DELETE', path: '/x', mediaType: '' }),
      createHttpResponse({ statusCode: 204, mediaType: '' }),
    ],
    [
      // The leading slash the format does NOT guarantee, and a lowercase method.
      'an unslashed path and a lowercase method',
      createHttpRequest({ method: 'get', path: 'launches', mediaType: '' }),
      createHttpResponse({ statusCode: 503, mediaType: 'text/plain' }),
    ],
  ];

  it.each(roundTripCases)('round-trips %s', (_label, request, response) => {
    const parts = parseSelector(formatSelector(request, response));

    expect(parts.method).toBe(request.method.toUpperCase());
    expect(parts.path).toBe(selectorPath(request.path));
    expect(parts.status).toBe(response.statusCode);
    expect(parts.requestMediaType).toBe(request.mediaType || undefined);
    expect(parts.responseMediaType).toBe(response.mediaType || undefined);
  });

  it('round-trips every transaction of a generated format', () => {
    const format = createThymianFormatWithTransactions(20);
    const transactions = format.getThymianHttpTransactions();

    expect(transactions).toHaveLength(20);

    for (const transaction of transactions) {
      const selector = selectorForTransaction(transaction);
      const parts = parseSelector(selector);

      expect(parts.method).toBe(transaction.thymianReq.method.toUpperCase());
      expect(parts.path).toBe(selectorPath(transaction.thymianReq.path));
      expect(parts.status).toBe(transaction.thymianRes.statusCode);
      expect(parts.requestMediaType).toBe(
        transaction.thymianReq.mediaType || undefined,
      );
      expect(parts.responseMediaType).toBe(
        transaction.thymianRes.mediaType || undefined,
      );
    }
  });

  it('round-trips media types that contain parameters', () => {
    const selector = formatSelector(
      createHttpRequest({
        method: 'POST',
        path: '/x',
        mediaType: 'application/json; charset=utf-8',
      }),
      createHttpResponse({
        statusCode: 200,
        mediaType: 'application/json; charset=utf-8',
      }),
    );

    expect(parseSelector(selector)).toEqual({
      method: 'POST',
      path: '/x',
      requestMediaType: 'application/json; charset=utf-8',
      status: 200,
      responseMediaType: 'application/json; charset=utf-8',
    });
  });

  /**
   * The third column is the canonical spelling the diagnostic must suggest, or
   * `undefined` when the input is too far gone to be a near-miss. Asserting it
   * per row is what makes the table discriminating — `error.name` alone is
   * constant across every row and would survive deleting the whole parser.
   */
  it.each([
    ['empty input', '', undefined],
    ['no status', 'GET /x', undefined],
    ['no method', '/x -> 200', undefined],
    ['wrong arrow', 'GET /x => 200', undefined],
    ['double spaces', 'GET /x  ->  200', undefined],
    ['lowercase method', 'get /x -> 200', 'GET /x -> 200'],
    [
      'a path without a leading slash',
      'GET launches -> 200',
      'GET /launches -> 200',
    ],
    ['a zero-padded status', 'GET /x -> 0200', 'GET /x -> 200'],
    ['unbalanced paren', 'GET /x -> 200 (application/json', undefined],
    [
      "core's display string",
      'GET /launches - application/json → 200 OK - application/json',
      undefined,
    ],
  ])('refuses to parse %s', (_label, input, canonical) => {
    const error = catchError(() => parseSelector(input));

    expect(error.name).toBe('MalformedSelectorError');
    expect(error.message).toBe(
      `"${input}" is not a valid transaction selector.`,
    );

    const suggestions = suggestionsOf(error);

    expect(suggestions).toContain(GRAMMAR_SUGGESTION);

    const hint = suggestions.find((suggestion) =>
      suggestion.includes('Did you mean'),
    );

    if (canonical === undefined) {
      expect(hint).toBeUndefined();
    } else {
      expect(hint).toContain(`"${canonical}"`);
    }
  });

  describe('the canonical-form hint', () => {
    function hintFor(value: string): string | undefined {
      return suggestionsOf(catchError(() => parseSelector(value))).find(
        (suggestion) => suggestion.includes('Did you mean'),
      );
    }

    /**
     * The sentence used to hardcode method case and the leading slash for every
     * normalization, so a zero-padded status was answered with advice about two
     * things that were already right.
     */
    it.each([
      [
        'get /x -> 200',
        'A selector spells its method in uppercase. Did you mean "GET /x -> 200"?',
      ],
      [
        'GET launches -> 200',
        'A selector spells its path with a leading "/". Did you mean "GET /launches -> 200"?',
      ],
      [
        'GET /x -> 0200',
        'A selector spells its status without leading zeros. Did you mean "GET /x -> 200"?',
      ],
      [
        'get launches -> 0200',
        'A selector spells its method in uppercase, spells its path with a leading "/" and spells its status without leading zeros. Did you mean "GET /launches -> 200"?',
      ],
    ])('states only the correction it made for %s', (input, expected) => {
      expect(hintFor(input)).toBe(expected);
    });

    /**
     * `selectorPath` prepends the missing slash unconditionally and
     * `SELECTOR_PATTERN` accepts the result, so the hint used to manufacture
     * paths out of values that are not paths at all.
     */
    it.each([
      ['a pasted absolute URL', 'GET https://api.example.com/launches -> 200'],
      ['an origin with a port', 'GET api.example.com:8080/launches -> 200'],
      ['an input with no path at all', 'GET (application/json) -> 200'],
      // The guard used to key off a `:` and a leading `(` only, so everything
      // below still had a slash prepended. Both cases above happen to carry a
      // colon, which is why the gap survived the round-2 fix.
      ['a scheme-less host', 'GET api.example.com/launches -> 200'],
      ['a www host', 'GET www.example.com/a -> 200'],
      ['a relative path', 'GET ../launches -> 200'],
      ['a bare query string', 'GET ?q=1 -> 200'],
      ['a bare fragment', 'GET #frag -> 200'],
    ])('invents no path from %s', (_label, input) => {
      expect(hintFor(input)).toBeUndefined();
    });

    /**
     * The mirror image of the same guard, and the half that was silently
     * over-strict: a `:` *inside* a path segment is an ordinary path character
     * (`{id}:activate` is a legal OpenAPI path), so refusing the whole hint on
     * "a `:` anywhere" swallowed the method-case and zero-padding corrections
     * too. What disqualifies a slash-less value is a `:` before the first `/`.
     */
    it.each([
      [
        'a multi-segment path',
        'GET v1/pets/{petId} -> 200',
        'A selector spells its path with a leading "/". Did you mean "GET /v1/pets/{petId} -> 200"?',
      ],
      [
        'a path whose segment carries a colon',
        'get users/{id}:activate -> 0200',
        'A selector spells its method in uppercase, spells its path with a leading "/" and spells its status without leading zeros. Did you mean "GET /users/{id}:activate -> 200"?',
      ],
    ])('still corrects %s that lost its leading slash', (_l, input, hint) => {
      expect(hintFor(input)).toBe(hint);
    });

    /**
     * A status code is exactly three digits (RFC 9110 §15). `Number(status)`
     * reinterpreted instead of canonicalizing: it turned "007" into "7" and
     * "0000" into "0", suggesting selectors no transaction can carry.
     */
    it.each([
      ['a padded status that is not a status code', 'GET /x -> 007'],
      ['an all-zero status', 'GET /x -> 0000'],
    ])('invents no status from %s', (_label, input) => {
      expect(hintFor(input)).toBeUndefined();
    });

    /**
     * The guard at the end of `canonicalFormHint`: a suggestion is only offered
     * if it is itself a selector. Leaving "007" alone therefore costs the
     * method correction too — which is the right trade, because every
     * alternative suggests a status no transaction can carry.
     */
    it('stays silent rather than half-correcting an uncanonicalizable status', () => {
      expect(hintFor('get /x -> 007')).toBeUndefined();
    });

    it('still corrects the method when the status is short but canonical', () => {
      expect(hintFor('get /x -> 20')).toBe(
        'A selector spells its method in uppercase. Did you mean "GET /x -> 20"?',
      );
    });
  });

  it('accepts the canonical form each hint suggests', () => {
    for (const input of [
      'get /x -> 200',
      'GET launches -> 200',
      'GET /x -> 0200',
    ]) {
      const hint = suggestionsOf(catchError(() => parseSelector(input))).find(
        (suggestion) => suggestion.includes('Did you mean'),
      );
      const canonical = /"([^"]+)"\?$/.exec(hint ?? '')?.[1];

      expect(canonical).toBeDefined();
      expect(() => parseSelector(String(canonical))).not.toThrow();
    }
  });
});
