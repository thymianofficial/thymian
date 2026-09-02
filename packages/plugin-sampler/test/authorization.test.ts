import { ThymianFormat } from '@thymian/core';
import {
  createHttpRequest,
  createHttpResponse,
  createOkResponse,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { type SamplerHarness, startSampler } from './plugin-harness.js';

/**
 * #12: the authorize hook supplies credentials; the per-Transaction `authorize`
 * flag decides whether it runs.
 *
 * The gate itself lives in core (`options.authorize && request.authorize`), so
 * what the sampler owns — and what is asserted here — is the flag's default, its
 * overridability, and which hook answers for a Transaction.
 */
describe('authorization', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);
    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  /**
   * A format with one secured operation exposing 200 and 401, and one unsecured
   * operation — built the way `plugin-openapi` builds one: an `is-secured` edge
   * from the request node to a security-scheme node is what makes a request
   * secured, and `requestIsSecured` looks for exactly that.
   */
  function securedFormat(): {
    format: ThymianFormat;
    secured200: string;
    secured401: string;
    open200: string;
  } {
    const format = new ThymianFormat();
    const scheme = format.addSecurityScheme({
      type: 'security-scheme',
      scheme: 'basic',
      sourceName: 'test-source',
    } as never);

    const securedReq = createHttpRequest({
      method: 'GET',
      path: '/astronauts',
    });

    const [securedReqId, , secured200] = format.addHttpTransaction(
      securedReq,
      createOkResponse(),
      'test-source',
    );
    const [, , secured401] = format.addHttpTransaction(
      securedReq,
      createHttpResponse({ statusCode: 401, mediaType: '' }),
      'test-source',
    );
    const [, , open200] = format.addHttpTransaction(
      createHttpRequest({ method: 'GET', path: '/launches' }),
      createOkResponse(),
      'test-source',
    );

    format.addEdge(securedReqId, scheme, {
      type: 'is-secured',
      sourceName: 'test-source',
    });

    return { format, secured200, secured401, open200 };
  }

  it('defaults the flag from the description: secured on, unsecured off', async () => {
    const { format, secured200, open200 } = securedFormat();
    const harness = await sampler();

    await harness.loadFormat(format);

    expect((await harness.sample(secured200, format)).authorize).toBe(true);
    expect((await harness.sample(open200, format)).authorize).toBe(false);
  });

  it('forces the flag off for a declared 401, so the negative case stays negative', async () => {
    const { format, secured401 } = securedFormat();
    const harness = await sampler();

    await harness.loadFormat(format);

    expect((await harness.sample(secured401, format)).authorize).toBe(false);
  });

  it('lets a targeted authorize win over the global one', async () => {
    const { format, secured200, open200 } = securedFormat();
    const harness = await sampler();

    await harness.writeHook(
      'auth.ts',
      `import { authorize } from '@thymian/hooks';

export const everywhere = authorize((request) => {
  request.headers['authorization'] = 'global';
});

export const forAstronauts = authorize(
  'GET /astronauts -> 200 (application/json)',
  (request) => {
    request.headers['authorization'] = 'targeted';
  },
);
`,
    );

    await harness.loadFormat(format);

    expect(
      (await harness.authorize(secured200, format)).result.headers[
        'authorization'
      ],
    ).toBe('targeted');
    // Everything the targeted hook does not cover still gets the global one.
    expect(
      (await harness.authorize(open200, format)).result.headers[
        'authorization'
      ],
    ).toBe('global');
  });

  it('runs exactly one authorize hook, the last registered in its tier', async () => {
    const { format, open200 } = securedFormat();
    const harness = await sampler();

    await harness.writeHook(
      'auth.ts',
      `import { authorize } from '@thymian/hooks';

export const first = authorize((request) => {
  request.headers['x-order'] = 'first';
});
export const second = authorize((request) => {
  request.headers['x-order'] = (request.headers['x-order'] ?? '') + 'second';
});
`,
    );

    await harness.loadFormat(format);

    // Not "firstsecond": two sets of credentials on one request is not a
    // composition, it is a conflict, so the later registration replaces the
    // earlier one.
    expect(
      (await harness.authorize(open200, format)).result.headers['x-order'],
    ).toBe('second');
  });

  it('passes the request through untouched when no authorize hook is registered', async () => {
    const { format, secured200 } = securedFormat();
    const harness = await sampler();

    await harness.loadFormat(format);

    const { result } = await harness.authorize(secured200, format);

    expect(result.headers['authorization']).toBeUndefined();
  });

  describe('overriding the flag', () => {
    it('statically, through defineSample, in both directions', async () => {
      const { format, secured200, open200 } = securedFormat();
      const harness = await sampler();

      await harness.writeHook(
        'flags.ts',
        `import { defineSample } from '@thymian/hooks';

export const off = defineSample(
  'GET /astronauts -> 200 (application/json)',
  (draft) => {
    draft.authorize = false;
  },
);

export const on = defineSample(
  'GET /launches -> 200 (application/json)',
  (draft) => {
    draft.authorize = true;
  },
);
`,
      );

      await harness.loadFormat(format);

      expect((await harness.sample(secured200, format)).authorize).toBe(false);
      expect((await harness.sample(open200, format)).authorize).toBe(true);
    });

    it('dynamically, through beforeEach, in both directions', async () => {
      const { format, secured200, open200 } = securedFormat();
      const harness = await sampler();

      await harness.writeHook(
        'flags.ts',
        `import { beforeEach } from '@thymian/hooks';

export const off = beforeEach(
  'GET /astronauts -> 200 (application/json)',
  (request) => {
    request.authorize = false;
  },
);

export const on = beforeEach(
  'GET /launches -> 200 (application/json)',
  (request) => {
    request.authorize = true;
  },
);
`,
      );

      await harness.loadFormat(format);

      // core evaluates its gate on the template `beforeRequest` handed back, so
      // a flag flipped here is the flag the gate reads.
      expect(
        (await harness.beforeRequest(secured200, format)).result.authorize,
      ).toBe(false);
      expect(
        (await harness.beforeRequest(open200, format)).result.authorize,
      ).toBe(true);
    });
  });
});
