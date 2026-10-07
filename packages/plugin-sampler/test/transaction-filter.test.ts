import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import {
  emptyValueFields,
  filterProblems,
  isTransactionFilter,
  matchesTransactionFilter,
} from '../src/selectors/transaction-filter.js';
import { type SamplerHarness, startSampler } from './plugin-harness.js';

function formatOf(
  pairs: Array<{
    method: string;
    path: string;
    status: number;
    requestMediaType?: string;
    responseMediaType?: string;
  }>,
): ThymianFormat {
  const format = new ThymianFormat();

  for (const pair of pairs) {
    format.addHttpTransaction(
      createHttpRequest({
        method: pair.method,
        path: pair.path,
        mediaType: pair.requestMediaType ?? '',
      }),
      createHttpResponse({
        statusCode: pair.status,
        mediaType: pair.responseMediaType ?? '',
      }),
      'test-source',
    );
  }

  return format;
}

const FIXTURE = formatOf([
  {
    method: 'GET',
    path: '/v1/admin',
    status: 200,
    responseMediaType: 'application/json',
  },
  {
    method: 'GET',
    path: '/v1/admin/users',
    status: 200,
    responseMediaType: 'application/json',
  },
  { method: 'DELETE', path: '/v1/admin/users/{id}', status: 204 },
  {
    method: 'GET',
    path: '/v1/launches',
    status: 200,
    responseMediaType: 'application/json',
  },
  {
    method: 'POST',
    path: '/v1/launches',
    status: 201,
    requestMediaType: 'application/json',
  },
  { method: 'GET', path: '/v1/launches', status: 404 },
]);

function matching(
  filter: Parameters<typeof matchesTransactionFilter>[0],
): string[] {
  return FIXTURE.getThymianHttpTransactions()
    .filter((transaction) => matchesTransactionFilter(filter, transaction))
    .map(
      (transaction) =>
        `${transaction.thymianReq.method} ${transaction.thymianReq.path} -> ${transaction.thymianRes.statusCode}`,
    )
    .sort();
}

describe('TransactionFilter', () => {
  it('AND-combines fields', () => {
    expect(matching({ method: 'GET', status: 200 })).toEqual([
      'GET /v1/admin -> 200',
      'GET /v1/admin/users -> 200',
      'GET /v1/launches -> 200',
    ]);
  });

  it('OR-combines an array within a field', () => {
    expect(matching({ status: [201, 204] })).toEqual([
      'DELETE /v1/admin/users/{id} -> 204',
      'POST /v1/launches -> 201',
    ]);
  });

  it('matches a status class', () => {
    expect(matching({ statusClass: '4XX' })).toEqual([
      'GET /v1/launches -> 404',
    ]);
  });

  it('matches declared media types', () => {
    expect(matching({ requestMediaType: 'application/json' })).toEqual([
      'POST /v1/launches -> 201',
    ]);
    expect(
      matching({ responseMediaType: 'application/json', method: 'GET' }),
    ).toEqual([
      'GET /v1/admin -> 200',
      'GET /v1/admin/users -> 200',
      'GET /v1/launches -> 200',
    ]);
  });

  it('broadcasts over a subtree with a trailing **', () => {
    // One-or-more: `/v1/admin` itself is not under `/v1/admin`.
    expect(matching({ path: '/v1/admin/**' })).toEqual([
      'DELETE /v1/admin/users/{id} -> 204',
      'GET /v1/admin/users -> 200',
    ]);
  });

  it('matches one segment with *, including a parameter segment', () => {
    expect(matching({ path: '/v1/admin/users/*' })).toEqual([
      'DELETE /v1/admin/users/{id} -> 204',
    ]);
  });

  it('excludes with not, and not takes globs too', () => {
    // `/v1/admin` survives: a trailing `**` is one-or-more, so `/v1/admin/**`
    // excludes what is *under* `/v1/admin` and not the subtree root itself.
    expect(matching({ path: '/v1/**', not: { path: '/v1/admin/**' } })).toEqual(
      [
        'GET /v1/admin -> 200',
        'GET /v1/launches -> 200',
        'GET /v1/launches -> 404',
        'POST /v1/launches -> 201',
      ],
    );
  });

  it('excludes anything matching any entry of a not array', () => {
    expect(
      matching({
        method: 'GET',
        not: [{ status: 404 }, { path: '/v1/admin/**' }],
      }),
    ).toEqual(['GET /v1/admin -> 200', 'GET /v1/launches -> 200']);
  });

  it('has the semantics positive(t) && !not.some(n => n(t))', () => {
    for (const transaction of FIXTURE.getThymianHttpTransactions()) {
      const positive = { method: 'GET' } as const;
      const exclusion = { status: 404 } as const;

      expect(
        matchesTransactionFilter({ ...positive, not: exclusion }, transaction),
      ).toBe(
        matchesTransactionFilter(positive, transaction) &&
          !matchesTransactionFilter(exclusion, transaction),
      );
    }
  });

  it('matches a status class by its first digit, not a registry', () => {
    const odd = formatOf([
      { method: 'GET', path: '/teapot', status: 418 },
      { method: 'GET', path: '/vendor', status: 499 },
    ]);

    // 418 and 499 are 4xx by arithmetic. Asking core's list of *registered*
    // status codes instead silently dropped both.
    expect(
      odd
        .getThymianHttpTransactions()
        .filter((t) => matchesTransactionFilter({ statusClass: '4XX' }, t)),
    ).toHaveLength(2);
  });

  it('tells a filter apart from a selector and a list of them', () => {
    expect(isTransactionFilter({ path: '/v1/**' })).toBe(true);
    expect(isTransactionFilter({ not: { status: 404 } })).toBe(true);
    expect(isTransactionFilter('GET /v1/launches -> 200')).toBe(false);
    expect(isTransactionFilter(['GET /v1/launches -> 200'])).toBe(false);
    // An object with no filter field is not a filter — it is a mistake, and
    // reporting it as "a filter that matched nothing" would name the wrong
    // fault.
    expect(isTransactionFilter({})).toBe(false);
    expect(isTransactionFilter({ tag: 'admin' })).toBe(false);
    // One known field is enough: a typo'd second key must be reported as a bad
    // key, not as "this was never a filter".
    expect(isTransactionFilter({ path: '/v1/**', tag: 'admin' })).toBe(true);
  });

  it('says what is wrong with a filter before asking what it matches', () => {
    expect(filterProblems({ path: '/v1/**' })).toEqual([]);
    expect(filterProblems({ statusClass: '4xx' })[0]).toContain(
      '"statusClass" was given "4xx", but it takes a status class',
    );
    expect(filterProblems({ status: '404' } as never)[0]).toContain(
      '"status" was given "404", but it takes a status code, as a number',
    );
    expect(filterProblems({ method: 42 } as never)[0]).toContain(
      '"method" was given 42, but it takes an HTTP method',
    );
    expect(filterProblems({ path: '/v1/**', tag: 'x' } as never)[0]).toContain(
      '"tag" is not a filter field',
    );
    // One level deep, and reported as such.
    expect(
      filterProblems({ path: '/v1/**', not: { status: 4040.5 } as never })[0],
    ).toContain('inside "not": "status" was given 4040.5');
  });

  it('matches nothing when a value array is explicitly empty', () => {
    // A disjunction of zero alternatives is false, not "this field doesn't
    // matter" — a computed filter array that comes back empty must not
    // silently widen into matching every method.
    expect(matching({ method: [] })).toEqual([]);
    expect(matching({ method: [], status: 200 })).toEqual([]);
  });

  it('still matches everything when a field is merely absent', () => {
    // The field is not present at all, which is the existing, unconstrained
    // meaning — distinct from being given an empty list.
    expect(matching({ method: undefined })).not.toEqual([]);
  });

  it('excludes nothing when `not` itself is an empty array', () => {
    // `not: []` is zero exclusion groups, so nothing is excluded — different
    // from a field inside `not` being an empty array (below).
    expect(matching({ method: 'GET', not: [] })).toEqual(
      matching({ method: 'GET' }),
    );
  });

  it('excludes nothing when a field inside `not` is an empty array', () => {
    // The exclusion group's own field can never match (empty disjunction), so
    // the group as a whole never triggers, and nothing is excluded — "not of
    // an empty array excludes nothing".
    expect(matching({ method: 'GET', not: { status: [] } })).toEqual(
      matching({ method: 'GET' }),
    );
  });

  it('names exactly the fields given an empty list, and only those', () => {
    expect(emptyValueFields({ path: '/v1/**' })).toEqual([]);
    expect(emptyValueFields({ method: [] })).toEqual(['method']);
    expect(emptyValueFields({ method: [], status: [] })).toEqual([
      'method',
      'status',
    ]);
    expect(emptyValueFields({ method: [], status: 200 })).toEqual(['method']);
    // A field that is merely absent is not "empty" — only one that was given
    // an empty list.
    expect(emptyValueFields({ method: undefined })).toEqual([]);
    // A `not` group's own empty field is not named by the top-level check;
    // `not` is one level deep by construction and is not itself a
    // `FilterFields` field.
    expect(emptyValueFields({ not: { status: [] } } as never)).toEqual([]);
  });
});

describe('filters as hook targets', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);
    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  function transactionIdOf(
    method: string,
    path: string,
    status: number,
  ): string {
    const found = FIXTURE.getThymianHttpTransactions().find(
      (t) =>
        t.thymianReq.method === method &&
        t.thymianReq.path === path &&
        t.thymianRes.statusCode === status,
    );

    if (!found) {
      throw new Error(`fixture has no ${method} ${path} -> ${status}`);
    }

    return found.transactionId;
  }

  it('covers a whole subtree with one hook', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'admin.ts',
      `import { beforeEach } from '@thymian/hooks';

export const admin = beforeEach({ path: '/v1/admin/**' }, (request) => {
  request.headers['x-admin'] = 'yes';
});
`,
    );

    await harness.loadFormat(FIXTURE);

    expect(
      (
        await harness.beforeRequest(
          transactionIdOf('GET', '/v1/admin/users', 200),
          FIXTURE,
        )
      ).result.headers['x-admin'],
    ).toBe('yes');
    // `/v1/admin` itself is not under `/v1/admin`, and neither is /v1/launches.
    expect(
      (
        await harness.beforeRequest(
          transactionIdOf('GET', '/v1/admin', 200),
          FIXTURE,
        )
      ).result.headers['x-admin'],
    ).toBeUndefined();
  });

  it('matches a path added to the description later', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'admin.ts',
      `import { beforeEach } from '@thymian/hooks';

export const admin = beforeEach({ path: '/v1/admin/**' }, (request) => {
  request.headers['x-admin'] = 'yes';
});
`,
    );

    await harness.loadFormat(FIXTURE);

    const grown = formatOf([
      {
        method: 'GET',
        path: '/v1/admin/users',
        status: 200,
        responseMediaType: 'application/json',
      },
      {
        method: 'GET',
        path: '/v1/admin/audit-log',
        status: 200,
        responseMediaType: 'application/json',
      },
    ]);

    await harness.loadFormat(grown);

    const added = grown
      .getThymianHttpTransactions()
      .find((t) => t.thymianReq.path === '/v1/admin/audit-log');

    if (!added) {
      throw new Error('fixture has no added path');
    }

    expect(
      (await harness.beforeRequest(added.transactionId, grown)).result.headers[
        'x-admin'
      ],
    ).toBe('yes');
  });

  it('fails the run fast on a vacuous glob, naming it and the subtree', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'typo.ts',
      `import { beforeEach } from '@thymian/hooks';

export const typo = beforeEach({ path: '/v1/admins/**' }, () => {});
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(FIXTURE);
    } catch (e) {
      error = e;
    }

    const suggestions = (
      (error as { options?: { suggestions?: string[] } }).options
        ?.suggestions ?? []
    ).join('\n');

    expect(suggestions).toContain(
      'the path glob "/v1/admins/**", which matches no path',
    );
    expect(suggestions).toContain('typo.ts');
    expect(suggestions).toContain('Paths under "/v1/" are:');
    expect(suggestions).toContain('"/v1/admin/users"');
  });

  it('fails the run fast on a vacuous glob inside not', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'typo.ts',
      `import { beforeEach } from '@thymian/hooks';

export const typo = beforeEach(
  { path: '/v1/**', not: { path: '/v1/nope/**' } },
  () => {},
);
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(FIXTURE);
    } catch (e) {
      error = e;
    }

    expect(
      (
        (error as { options?: { suggestions?: string[] } }).options
          ?.suggestions ?? []
      ).join('\n'),
    ).toContain('the path glob "/v1/nope/**", which matches no path');
  });

  it('fails the run fast on a filter whose valid values intersect nothing', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'impossible.ts',
      `import { beforeEach } from '@thymian/hooks';

export const impossible = beforeEach(
  { path: '/v1/launches', method: 'DELETE' },
  () => {},
);
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(FIXTURE);
    } catch (e) {
      error = e;
    }

    const suggestions = (
      (error as { options?: { suggestions?: string[] } }).options
        ?.suggestions ?? []
    ).join('\n');

    expect(suggestions).toContain('intersect no transaction');
    expect(suggestions).toContain('impossible.ts');
  });

  it('calls a wildcard-bearing value a glob, whole-segment or not', async () => {
    const harness = await sampler();

    // `/v1/launch*` is a glob the user wrote — `PathGlob` accepts it and the
    // grammar makes `launch*` a literal segment, so it names nothing. Telling
    // that user no path is *spelled* `/v1/launch*` is true and useless.
    await harness.writeHook(
      'partial.ts',
      `import { beforeEach } from '@thymian/hooks';

export const partial = beforeEach({ path: '/v1/launch*' }, () => {});
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(FIXTURE);
    } catch (e) {
      error = e;
    }

    expect(
      (
        (error as { options?: { suggestions?: string[] } }).options
          ?.suggestions ?? []
      ).join('\n'),
    ).toContain('the path glob "/v1/launch*", which matches no path');
  });

  it('reports a bad filter value as a bad value, not as an empty match', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'typo.ts',
      `import { beforeEach } from '@thymian/hooks';

export const typo = beforeEach({ statusClass: '4xx' }, () => {});
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(FIXTURE);
    } catch (e) {
      error = e;
    }

    const suggestions = (
      (error as { options?: { suggestions?: string[] } }).options
        ?.suggestions ?? []
    ).join('\n');

    expect(suggestions).toContain('a filter that cannot mean anything');
    expect(suggestions).toContain('"statusClass" was given "4xx"');
    expect(suggestions).not.toContain('intersect no transaction');
  });

  it('counts hooks, not diagnostics, when one hook has two bad globs', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'two.ts',
      `import { beforeEach } from '@thymian/hooks';

export const two = beforeEach(
  { path: ['/v1/nope/**', '/v1/also-nope/**'] },
  () => {},
);
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(FIXTURE);
    } catch (e) {
      error = e;
    }

    expect((error as Error | undefined)?.message).toContain(
      '1 sampler hook does not resolve',
    );
  });

  it('targets defineSample and authorize by filter too', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'both.ts',
      `import { authorize, defineSample } from '@thymian/hooks';

export const shape = defineSample({ path: '/v1/admin/**' }, (draft) => {
  draft.headers['x-shaped'] = 'yes';
});

export const creds = authorize({ statusClass: '2XX' }, (request) => {
  request.headers['authorization'] = 'targeted-by-filter';
});
`,
    );

    await harness.loadFormat(FIXTURE);

    expect(
      (
        await harness.sample(
          transactionIdOf('GET', '/v1/admin/users', 200),
          FIXTURE,
        )
      ).headers['x-shaped'],
    ).toBe('yes');
    expect(
      (
        await harness.authorize(
          transactionIdOf('GET', '/v1/launches', 200),
          FIXTURE,
        )
      ).result.headers['authorization'],
    ).toBe('targeted-by-filter');
  });

  it('fails the run fast on a filter field given an empty list of values', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'empty.ts',
      `import { beforeEach } from '@thymian/hooks';

export const empty = beforeEach({ method: [] }, () => {});
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(FIXTURE);
    } catch (e) {
      error = e;
    }

    const suggestions = (
      (error as { options?: { suggestions?: string[] } }).options
        ?.suggestions ?? []
    ).join('\n');

    expect(suggestions).toContain('"method"');
    expect(suggestions).toContain('given an empty list of values');
    expect(suggestions).toContain('so it targets nothing');
    expect(suggestions).toContain('empty.ts');
  });

  it('reports an exact path nothing is spelled as, differently from a glob', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'typo.ts',
      `import { beforeEach } from '@thymian/hooks';

export const typo = beforeEach({ path: '/v1/launch' }, () => {});
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(FIXTURE);
    } catch (e) {
      error = e;
    }

    expect(
      (
        (error as { options?: { suggestions?: string[] } }).options
          ?.suggestions ?? []
      ).join('\n'),
    ).toContain(
      'the path "/v1/launch", which no path in the loaded API description is spelled as',
    );
  });
});

/**
 * `matchesFields` is an `every` over the fields that are present, so a group
 * with none is vacuously true. As a positive filter that is right — it leaves
 * every field open. As an *exclusion* it means "not anything", which quietly
 * removed the whole catalog and then reported the wrong fault: the author saw
 * "values are all valid but intersect no transaction" and went looking at
 * their values.
 */
describe('an exclusion that constrains nothing', () => {
  const EMPTY_EXCLUSIONS = [
    ['{}', {}],
    ['a field explicitly undefined', { path: undefined }],
    ['only a nested not, which is not a field', { not: { method: 'GET' } }],
  ] as const;

  it.each(EMPTY_EXCLUSIONS)('excludes nothing: %s', (_name, exclusion) => {
    const positive = { method: 'GET' } as const;

    expect(
      matching({ ...positive, not: exclusion as never }),
      'the exclusion must not narrow the positive filter',
    ).toEqual(matching(positive));
  });

  it.each(EMPTY_EXCLUSIONS)(
    'is reported as a problem: %s',
    (_name, exclusion) => {
      expect(
        filterProblems({ method: 'GET', not: exclusion as never }).join('\n'),
      ).toContain('constrains nothing');
    },
  );

  it('leaves a real exclusion working', () => {
    expect(matching({ method: 'GET', not: { status: 404 } })).not.toContain(
      'GET /v1/launches -> 404',
    );
    expect(
      matching({ method: 'GET', not: { status: 404 } }).length,
    ).toBeGreaterThan(0);
  });
});
