import {
  createHttpRequest,
  createHttpResponse,
  createOkResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { type SamplerHarness, startSampler } from './plugin-harness.js';

/**
 * #11: the lifecycle beyond `beforeEach` — `defineSample` at generation time,
 * `afterEach` over the response, and the run-scoped `beforeAll`/`afterAll`
 * pair. Everything is observed through the request that would be sent, the
 * response a hook saw, or the order a teardown ran in.
 */
describe('hook lifecycle', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);
    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  const format = createThymianFormatWithTransactions([
    [
      createHttpRequest({ method: 'GET', path: '/launches' }),
      createOkResponse(),
    ],
    [
      createHttpRequest({
        method: 'POST',
        path: '/astronauts',
        mediaType: 'application/json',
      }),
      createHttpResponse({ statusCode: 201 }),
    ],
  ]);

  const LAUNCHES = 'GET /launches -> 200 (application/json)';

  function transactionIdOf(path: string): string {
    const found = format
      .getThymianHttpTransactions()
      .find((t) => t.thymianReq.path === path);

    if (!found) {
      throw new Error(`fixture has no transaction for ${path}`);
    }

    return found.transactionId;
  }

  describe('defineSample', () => {
    it('shapes the generated request, and shows through sampler show', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'sample.ts',
        `import { defineSample } from '@thymian/hooks';

export const shapeLaunches = defineSample(${JSON.stringify(LAUNCHES)}, (draft) => {
  draft.query['limit'] = 7;
  draft.authorize = true;
});
`,
      );

      await harness.loadFormat(format);

      const shown = await harness.show(LAUNCHES);

      expect(shown.request.query['limit']).toBe(7);
      expect(shown.request.authorize).toBe(true);

      // And the same request is what the tester is handed.
      const sample = await harness.sample(transactionIdOf('/launches'), format);

      expect(sample.query['limit']).toBe(7);
    });

    it('reports a second defineSample for one transaction as a conflict', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'first.ts',
        `import { defineSample } from '@thymian/hooks';
export const one = defineSample(${JSON.stringify(LAUNCHES)}, () => {});
`,
      );
      await harness.writeHook(
        'second.ts',
        `import { defineSample } from '@thymian/hooks';
export const two = defineSample(${JSON.stringify(LAUNCHES)}, () => {});
`,
      );

      let error: unknown;

      try {
        await harness.loadFormat(format);
      } catch (e) {
        error = e;
      }

      const suggestions = (
        (error as { options?: { suggestions?: string[] } }).options
          ?.suggestions ?? []
      ).join('\n');

      expect((error as Error | undefined)?.message).toContain(
        'conflicts with another hook on the same transaction',
      );
      expect(suggestions).toContain('defineSample is already defined');
      // Both sides are named, so the reader knows which two files to open.
      expect(suggestions).toContain('second.ts');
      expect(suggestions).toContain('first.ts');
    });

    it('allows one defineSample per transaction across transactions', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'two-transactions.ts',
        `import { defineSample } from '@thymian/hooks';

export const a = defineSample(${JSON.stringify(LAUNCHES)}, (draft) => {
  draft.headers['x-which'] = 'launches';
});
export const b = defineSample(
  'POST /astronauts (application/json) -> 201 (application/json)',
  (draft) => {
    draft.headers['x-which'] = 'astronauts';
  },
);
`,
      );

      await harness.loadFormat(format);

      expect((await harness.show(LAUNCHES)).request.headers['x-which']).toBe(
        'launches',
      );
      expect(
        (
          await harness.show(
            'POST /astronauts (application/json) -> 201 (application/json)',
          )
        ).request.headers['x-which'],
      ).toBe('astronauts');
    });
  });

  describe('afterEach', () => {
    it('sees the response of its own transaction', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'assert.ts',
        `import { afterEach } from '@thymian/hooks';

export const checkStatus = afterEach(${JSON.stringify(LAUNCHES)}, (response, ctx, utils) => {
  if (response.statusCode === 200) {
    utils.assertionSuccess('status was 200', 'statusCode === 200');
  } else {
    utils.assertionFailure('unexpected status ' + response.statusCode);
  }
});
`,
      );

      await harness.loadFormat(format);

      const { testResults } = await harness.afterResponse(
        transactionIdOf('/launches'),
        format,
        { statusCode: 200, headers: {}, body: '{}' } as never,
      );

      expect(testResults).toEqual([
        {
          type: 'assertion-success',
          message: 'status was 200',
          assertion: 'statusCode === 200',
        },
      ]);
    });
  });

  describe('beforeAll and afterAll', () => {
    it('runs beforeAll exactly once, before the first request', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'setup.ts',
        `import { beforeAll, beforeEach } from '@thymian/hooks';

let runs = 0;

export const setup = beforeAll(() => {
  runs += 1;
});

export const record = beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
  request.headers['x-before-all-runs'] = String(runs);
});
`,
      );

      await harness.loadFormat(format);

      const first = await harness.beforeRequest(
        transactionIdOf('/launches'),
        format,
      );
      const second = await harness.beforeRequest(
        transactionIdOf('/launches'),
        format,
      );

      // Already 1 on the very first request: the latch is armed ahead of the
      // transaction's own beforeEach hooks.
      expect(first.result.headers['x-before-all-runs']).toBe('1');
      expect(second.result.headers['x-before-all-runs']).toBe('1');
    });

    it('aborts the run when beforeAll throws, and still tears down', async () => {
      const harness = await sampler();

      await harness.writeHook(
        'setup.ts',
        `import { afterAll, beforeAll } from '@thymian/hooks';
import { appendFileSync } from 'node:fs';

const log = ${JSON.stringify('LOGPATH')};

export const setup = beforeAll(() => {
  throw new Error('setup failed');
});

export const teardown = afterAll(() => {
  appendFileSync(log, 'afterAll\\n');
});
`.replace(
          JSON.stringify('LOGPATH'),
          JSON.stringify(`${harness.cwd}/order.log`),
        ),
      );

      await harness.loadFormat(format);

      await expect(
        harness.beforeRequest(transactionIdOf('/launches'), format),
      ).rejects.toThrowError(/beforeAll hook exported as "setup"/);

      await harness.close();

      const { readFileSync } = await import('node:fs');

      expect(readFileSync(`${harness.cwd}/order.log`, 'utf-8')).toBe(
        'afterAll\n',
      );
    });

    it('runs all teardown as one reverse-ordered list on close', async () => {
      const harness = await sampler();
      const log = `${harness.cwd}/order.log`;

      await harness.writeHook(
        'setup.ts',
        `import { afterAll, beforeAll } from '@thymian/hooks';
import { appendFileSync } from 'node:fs';

const log = ${JSON.stringify(log)};

export const first = beforeAll(() => () => {
  appendFileSync(log, 'cleanup-1\\n');
});

export const second = beforeAll(() => () => {
  appendFileSync(log, 'cleanup-2\\n');
});

export const teardownA = afterAll(() => {
  appendFileSync(log, 'afterAll-A\\n');
});

export const teardownB = afterAll(() => {
  appendFileSync(log, 'afterAll-B\\n');
});
`,
      );

      await harness.loadFormat(format);
      await harness.beforeRequest(transactionIdOf('/launches'), format);
      await harness.close();

      const { readFileSync } = await import('node:fs');

      // One list, reversed — not "all cleanups, then all afterAll". Both
      // `afterAll` hooks were registered after both `beforeAll` hooks, so they
      // run first; within each, the later registration goes first.
      expect(readFileSync(log, 'utf-8')).toBe(
        'afterAll-B\nafterAll-A\ncleanup-2\ncleanup-1\n',
      );
    });

    it('keeps tearing down after a teardown throws', async () => {
      const harness = await sampler();
      const log = `${harness.cwd}/order.log`;

      await harness.writeHook(
        'setup.ts',
        `import { afterAll, beforeAll } from '@thymian/hooks';
import { appendFileSync } from 'node:fs';

const log = ${JSON.stringify(log)};

export const arm = beforeAll(() => () => {
  appendFileSync(log, 'cleanup\\n');
});

export const throwing = afterAll(() => {
  throw new Error('teardown failed');
});

export const survivor = afterAll(() => {
  appendFileSync(log, 'survivor\\n');
});
`,
      );

      await harness.loadFormat(format);
      await harness.beforeRequest(transactionIdOf('/launches'), format);

      // Best-effort: the throw does not propagate out of close.
      await expect(harness.close()).resolves.toBeUndefined();

      const { readFileSync } = await import('node:fs');

      // `survivor` is registered last, so it runs first in reverse; the
      // throwing hook is next and is only warned about; the cleanup of the
      // first-registered `beforeAll` runs last.
      expect(readFileSync(log, 'utf-8')).toBe('survivor\ncleanup\n');
    });

    it('interleaves a cleanup with an afterAll registered after it', async () => {
      const harness = await sampler();
      const log = `${harness.cwd}/order.log`;

      await harness.writeHook(
        'setup.ts',
        `import { afterAll, beforeAll } from '@thymian/hooks';
import { appendFileSync } from 'node:fs';

const log = ${JSON.stringify(log)};

export const early = beforeAll(() => () => {
  appendFileSync(log, 'cleanup-early\\n');
});

export const between = afterAll(() => {
  appendFileSync(log, 'afterAll-between\\n');
});

export const late = beforeAll(() => () => {
  appendFileSync(log, 'cleanup-late\\n');
});
`,
      );

      await harness.loadFormat(format);
      await harness.beforeRequest(transactionIdOf('/launches'), format);
      await harness.close();

      const { readFileSync } = await import('node:fs');

      // Reverse of the order things were registered in, whatever kind they are:
      // the late cleanup, then the afterAll between them, then the early
      // cleanup. Grouping cleanups apart from afterAll hooks would put
      // `afterAll-between` first or last instead of in the middle.
      expect(readFileSync(log, 'utf-8')).toBe(
        'cleanup-late\nafterAll-between\ncleanup-early\n',
      );
    });

    it('runs no teardown when no request was ever sent', async () => {
      const harness = await sampler();
      const log = `${harness.cwd}/order.log`;

      await harness.writeHook(
        'setup.ts',
        `import { afterAll } from '@thymian/hooks';
import { appendFileSync } from 'node:fs';

export const teardown = afterAll(() => {
  appendFileSync(${JSON.stringify(log)}, 'ran\\n');
});
`,
      );

      await harness.loadFormat(format);
      // A non-test command: the selector was shown, no request was sent.
      await harness.show(LAUNCHES);
      await harness.close();

      const { existsSync } = await import('node:fs');

      expect(existsSync(log)).toBe(false);
    });
  });

  describe('what the scan ignores', () => {
    it('skips dot-directories and declaration files', async () => {
      const harness = await sampler();

      // Both would fail loudly if the scan reached them: the first registers a
      // hook against a selector that does not exist, the second is not
      // importable as a module.
      await harness.writeHook(
        '.cache/hidden.ts',
        `import { beforeEach } from '@thymian/hooks';
export const hidden = beforeEach('GET /gone -> 200 (application/json)', () => {});
`,
      );
      await harness.writeHook(
        'types.d.ts',
        `declare module 'nonexistent-module' {
  export const x: number;
}
`,
      );

      await expect(harness.loadFormat(format)).resolves.toBeUndefined();
    });
  });
});
