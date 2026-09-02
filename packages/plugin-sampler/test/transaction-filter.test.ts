import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import {
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
      await harness.loadFormat(FIXTURE);
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
      await harness.loadFormat(FIXTURE);
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
      await harness.loadFormat(FIXTURE);
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
      await harness.loadFormat(FIXTURE);
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
