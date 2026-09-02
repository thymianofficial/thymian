import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ThymianFormat } from '@thymian/core';
import { createHttpRequest, createHttpResponse } from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { type SamplerHarness, startSampler } from './plugin-harness.js';

/**
 * #14: the `utils` object every hook is handed — typed setters, file helpers
 * that resolve beside the hook, and a selector-keyed cross-endpoint request
 * with a cycle guard.
 */
describe('the utils surface', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);
    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  const FIXTURE = (() => {
    const format = new ThymianFormat();

    format.addHttpTransaction(
      createHttpRequest({ method: 'GET', path: '/launches/{id}' }),
      createHttpResponse({ statusCode: 200 }),
      'test-source',
    );
    format.addHttpTransaction(
      createHttpRequest({
        method: 'POST',
        path: '/launches',
        mediaType: 'application/json',
      }),
      createHttpResponse({ statusCode: 201 }),
      'test-source',
    );

    return format;
  })();

  const GET_LAUNCH = 'GET /launches/{id} -> 200 (application/json)';
  const CREATE_LAUNCH =
    'POST /launches (application/json) -> 201 (application/json)';

  function transactionIdOf(selector: string): string {
    const found = FIXTURE.getThymianHttpTransactions().find((t) =>
      selector.startsWith(`${t.thymianReq.method.toUpperCase()} `) &&
      selector.includes(` ${t.thymianReq.path} `) === false
        ? selector.includes(t.thymianReq.path)
        : selector.includes(t.thymianReq.path),
    );

    if (!found) {
      throw new Error(`fixture has no transaction for ${selector}`);
    }

    return found.transactionId;
  }

  describe('typed setters', () => {
    it('produce the same request as direct mutation', async () => {
      const viaSetters = await sampler();
      const viaMutation = await sampler();

      await viaSetters.writeHook(
        'setters.ts',
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(GET_LAUNCH)}, (request, ctx, utils) => {
  utils.setHeader('x-trace', 'yes');
  utils.setQuery('expand', 'crew');
  utils.setPathParam('id', 42);
  utils.setCookie('session', 'abc');
  utils.setBody({ hello: 'world' });
  utils.setAuthorize(true);
});
`,
      );
      await viaMutation.writeHook(
        'mutation.ts',
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(GET_LAUNCH)}, (request) => {
  request.headers['x-trace'] = 'yes';
  request.query['expand'] = 'crew';
  request.pathParameters['id'] = 42;
  request.cookies['session'] = 'abc';
  request.body = { hello: 'world' };
  request.authorize = true;
});
`,
      );

      await viaSetters.loadFormat(FIXTURE);
      await viaMutation.loadFormat(FIXTURE);

      const id = transactionIdOf(GET_LAUNCH);

      expect((await viaSetters.beforeRequest(id, FIXTURE)).result).toEqual(
        (await viaMutation.beforeRequest(id, FIXTURE)).result,
      );
    });

    it('name the mistake when a hook has no request to shape', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'wrong.ts',
        `import { beforeAll } from '@thymian/hooks';

export const wrong = beforeAll((utils) => {
  utils.setHeader('x-trace', 'yes');
});
`,
      );

      await harness.loadFormat(FIXTURE);

      let error: unknown;

      try {
        await harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE);
      } catch (e) {
        error = e;
      }

      // The diagnostic keeps its own words; the hook's location joins its
      // suggestions rather than replacing them.
      expect((error as Error | undefined)?.message).toMatch(
        /utils\.setHeader needs a request to write into/,
      );
      expect(
        (
          (error as { options?: { suggestions?: string[] } }).options
            ?.suggestions ?? []
        ).join('\n'),
      ).toContain('the beforeAll hook exported as "wrong" from "wrong.ts"');
    });
  });

  describe('file helpers', () => {
    it('resolve a relative path against the hook file, not the cwd', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'deep/nested/hook.ts',
        `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(${JSON.stringify(GET_LAUNCH)}, (request, ctx, utils) => {
  request.body = utils.readJson('./payload.json');
  request.headers['x-text'] = utils.readText('./payload.json').trim().length + '';
  request.headers['x-bytes'] = utils.readFile('./payload.json').length + '';
});
`,
      );
      await writeFile(
        join(harness.hooksDir, 'deep', 'nested', 'payload.json'),
        JSON.stringify({ from: 'beside the hook' }),
        'utf-8',
      );

      await harness.loadFormat(FIXTURE);

      const { result } = await harness.beforeRequest(
        transactionIdOf(GET_LAUNCH),
        FIXTURE,
      );

      expect(result.body).toEqual({ from: 'beside the hook' });
      expect(result.headers['x-text']).toBe('26');
      expect(result.headers['x-bytes']).toBe('26');
    });
  });

  describe('utils.request', () => {
    it('resolves a selector through the catalog and sends it', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'seed.ts',
        `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  const created = await utils.request(${JSON.stringify(CREATE_LAUNCH)}, {
    body: { name: 'Artemis' },
  });

  request.pathParameters['id'] = created.statusCode;
});
`,
      );

      harness.responses.push({
        statusCode: 201,
        body: JSON.stringify({ id: 7 }),
      });

      await harness.loadFormat(FIXTURE);

      const { result } = await harness.beforeRequest(
        transactionIdOf(GET_LAUNCH),
        FIXTURE,
      );

      // The nested request went on the wire, with the caller's body.
      expect(harness.dispatched).toHaveLength(1);
      expect(harness.dispatched[0]?.request.method).toBe('POST');
      expect(harness.dispatched[0]?.request.body).toContain('Artemis');
      // And its parsed response came back to the caller.
      expect(result.pathParameters['id']).toBe(201);
    });

    it('runs the target’s own hooks by default, and not with runHooks false', async () => {
      for (const runHooks of [true, false]) {
        const harness = await sampler();

        await harness.writeHook(
          'seed.ts',
          `import { beforeEach } from '@thymian/hooks';

export const targetHook = beforeEach(${JSON.stringify(CREATE_LAUNCH)}, (request) => {
  request.headers['x-target-hook'] = 'ran';
});

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE_LAUNCH)}, {}, { runHooks: ${runHooks} });
});
`,
        );

        await harness.loadFormat(FIXTURE);
        await harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE);

        expect(
          harness.dispatched[0]?.request.headers?.['x-target-hook'],
          `runHooks: ${runHooks}`,
        ).toBe(runHooks ? 'ran' : undefined);
      }
    });

    it('runs the target’s authorize hook when its flag says so', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'seed.ts',
        `import { authorize, beforeEach } from '@thymian/hooks';

export const creds = authorize((request) => {
  request.headers['authorization'] = 'from-authorize';
});

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE_LAUNCH)}, {}, { authorize: true });
});
`,
      );

      await harness.loadFormat(FIXTURE);
      await harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE);

      expect(harness.dispatched[0]?.request.headers?.['authorization']).toBe(
        'from-authorize',
      );
    });

    it('gives the suggestion diagnostic for an unknown selector', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'seed.ts',
        `import { beforeEach } from '@thymian/hooks';

export const seed = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request('POST /launches (application/json) -> 418 (application/json)');
});
`,
      );

      await harness.loadFormat(FIXTURE);

      await expect(
        harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE),
      ).rejects.toThrowError(/No transaction matches the selector/);
    });
  });

  describe('the cycle guard', () => {
    it('fails a self-targeting call, printing the chain', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'cycle.ts',
        `import { beforeEach } from '@thymian/hooks';

export const seedsItself = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(GET_LAUNCH)});
});
`,
      );

      await harness.loadFormat(FIXTURE);

      let error: unknown;

      try {
        await harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE);
      } catch (e) {
        error = e;
      }

      expect((error as Error | undefined)?.message).toContain(
        `would re-enter "${GET_LAUNCH}", which is already running`,
      );

      const suggestions = (
        (error as { options?: { suggestions?: string[] } }).options
          ?.suggestions ?? []
      ).join('\n');

      expect(suggestions).toContain('The chain is:');
      expect(suggestions).toContain(GET_LAUNCH);
      expect(suggestions).toContain('runHooks: false');
      // Nothing was sent: the guard fires before the request is built.
      expect(harness.dispatched).toHaveLength(0);
    });

    it('fails an A → B → A pair, printing both selectors in order', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'cycle.ts',
        `import { beforeEach } from '@thymian/hooks';

export const a = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE_LAUNCH)});
});

export const b = beforeEach(${JSON.stringify(CREATE_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(GET_LAUNCH)});
});
`,
      );

      await harness.loadFormat(FIXTURE);

      let error: unknown;

      try {
        await harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE);
      } catch (e) {
        error = e;
      }

      const suggestions = (
        (error as { options?: { suggestions?: string[] } }).options
          ?.suggestions ?? []
      ).join('\n');

      const chain = suggestions.slice(suggestions.indexOf('The chain is:'));

      expect(chain.indexOf(GET_LAUNCH)).toBeLessThan(
        chain.indexOf(CREATE_LAUNCH),
      );
      expect(chain.lastIndexOf(GET_LAUNCH)).toBeGreaterThan(
        chain.indexOf(CREATE_LAUNCH),
      );
      expect(chain).toContain('runHooks: false');
    });

    it('lets runHooks false break the cycle', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'cycle.ts',
        `import { beforeEach } from '@thymian/hooks';

export const a = beforeEach(${JSON.stringify(GET_LAUNCH)}, async (request, ctx, utils) => {
  await utils.request(${JSON.stringify(CREATE_LAUNCH)});
});

export const b = beforeEach(${JSON.stringify(CREATE_LAUNCH)}, async (request, ctx, utils) => {
  // The path parameter has no generated value, so the caller supplies it —
  // which is also what the args overlay is for.
  await utils.request(
    ${JSON.stringify(GET_LAUNCH)},
    { path: { id: 1 } },
    { runHooks: false },
  );
});
`,
      );

      await harness.loadFormat(FIXTURE);

      await expect(
        harness.beforeRequest(transactionIdOf(GET_LAUNCH), FIXTURE),
      ).resolves.toBeDefined();

      // The raw request still went out; it just did not re-enter the pipeline.
      expect(harness.dispatched.map((d) => d.request.method)).toEqual([
        'GET',
        'POST',
      ]);
    });
  });
});
