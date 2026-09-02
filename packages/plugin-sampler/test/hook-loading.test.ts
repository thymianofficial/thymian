import {
  createHttpRequest,
  createHttpResponse,
  createOkResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { isHookFile } from '../src/hooks/load-user-hooks.js';
import { type SamplerHarness, startSampler } from './plugin-harness.js';

/**
 * #10: a user writes a `beforeEach` anchored by a Selector, runs with **no
 * `init`**, and sees the mutation on the wire. Every assertion here observes
 * either the outgoing request or the diagnostic a broken hook produces — never
 * the loader's internals.
 */
describe('hook loading', () => {
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
  const ASTRONAUTS =
    'POST /astronauts (application/json) -> 201 (application/json)';

  function transactionIdOf(selector: string): string {
    const found = format
      .getThymianHttpTransactions()
      .find(
        (t) =>
          selector.startsWith(`${t.thymianReq.method.toUpperCase()} `) &&
          selector.includes(t.thymianReq.path),
      );

    if (!found) {
      throw new Error(`fixture has no transaction for ${selector}`);
    }

    return found.transactionId;
  }

  it('fires a beforeEach on the wire with no init ever run', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'auth.ts',
      `import { beforeEach } from '@thymian/hooks';

export const addTraceHeader = beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
  request.headers['x-trace'] = 'from-hook';
});
`,
    );

    await harness.loadFormat(format);

    const { result } = await harness.beforeRequest(
      transactionIdOf(LAUNCHES),
      format,
    );

    expect(result.headers['x-trace']).toBe('from-hook');
  });

  it('ignores what a hook returns, because a hook mutates in place', async () => {
    const harness = await sampler();

    // The most ordinary shorthand there is: a concise arrow whose body is an
    // assignment, so the function returns the assigned value. Honouring that
    // return would replace the whole request with the string 'from-hook'.
    await harness.writeHook(
      'concise.ts',
      `import { beforeEach } from '@thymian/hooks';

export const concise = beforeEach(
  ${JSON.stringify(LAUNCHES)},
  (request) => (request.headers['x-trace'] = 'from-hook'),
);
`,
    );

    await harness.loadFormat(format);

    const { result } = await harness.beforeRequest(
      transactionIdOf(LAUNCHES),
      format,
    );

    expect(result.headers['x-trace']).toBe('from-hook');
    expect(result.method).toBe('GET');
    expect(result.path).toBe('/launches');
  });

  it('leaves other transactions alone', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'auth.ts',
      `import { beforeEach } from '@thymian/hooks';

export default beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
  request.headers['x-trace'] = 'from-hook';
});
`,
    );

    await harness.loadFormat(format);

    const { result } = await harness.beforeRequest(
      transactionIdOf(ASTRONAUTS),
      format,
    );

    expect(result.headers['x-trace']).toBeUndefined();
  });

  it('composes several beforeEach hooks in registration order', async () => {
    const harness = await sampler();

    // Two files, two hooks each, and in both files the export names run
    // backwards against the registration order. So neither export order (an ESM
    // namespace sorts its keys) nor file order alone can produce "1234": the
    // order has to come from file order on the outside and registration order
    // inside each file.
    await harness.writeHook(
      'b-second.ts',
      `import { beforeEach } from '@thymian/hooks';

export const zzz = beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
  request.headers['x-order'] += '3';
});
export const aaa = beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
  request.headers['x-order'] += '4';
});
`,
    );
    await harness.writeHook(
      'a-first.ts',
      `import { beforeEach } from '@thymian/hooks';

export const zzz = beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
  request.headers['x-order'] = '1';
});
export const aaa = beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
  request.headers['x-order'] += '2';
});
`,
    );

    await harness.loadFormat(format);

    const { result } = await harness.beforeRequest(
      transactionIdOf(LAUNCHES),
      format,
    );

    expect(result.headers['x-order']).toBe('1234');
  });

  it('collects registrations from any nesting depth, and a list of them', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'deep/nested/again/hooks.ts',
      `import { beforeEach } from '@thymian/hooks';

export const both = [
  beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
    request.headers['x-one'] = 'yes';
  }),
  beforeEach(${JSON.stringify(LAUNCHES)}, (request) => {
    request.headers['x-two'] = 'yes';
  }),
];
`,
    );

    await harness.loadFormat(format);

    const { result } = await harness.beforeRequest(
      transactionIdOf(LAUNCHES),
      format,
    );

    expect(result.headers['x-one']).toBe('yes');
    expect(result.headers['x-two']).toBe('yes');
  });

  it('targets a list of selectors with one hook', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'both.ts',
      `import { beforeEach } from '@thymian/hooks';

export const shared = beforeEach(
  [${JSON.stringify(LAUNCHES)}, ${JSON.stringify(ASTRONAUTS)}],
  (request) => {
    request.headers['x-shared'] = 'yes';
  },
);
`,
    );

    await harness.loadFormat(format);

    for (const selector of [LAUNCHES, ASTRONAUTS]) {
      const { result } = await harness.beforeRequest(
        transactionIdOf(selector),
        format,
      );

      expect(result.headers['x-shared'], selector).toBe('yes');
    }
  });

  it('never invokes an exported function to find out whether it is a hook', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'not-a-hook.ts',
      `export function looksInteresting() {
  throw new Error('discovery invoked an exported function');
}
export default function alsoNot() {
  throw new Error('discovery invoked the default export');
}
`,
    );

    await harness.loadFormat(format);

    await expect(
      harness.beforeRequest(transactionIdOf(LAUNCHES), format),
    ).resolves.toBeDefined();
  });

  it('fails the run fast on a dangling selector, naming the file and near misses', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'stale.ts',
      `import { beforeEach } from '@thymian/hooks';

export const stale = beforeEach('GET /launches -> 418 (application/json)', () => {});
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(format);
    } catch (e) {
      error = e;
    }

    expect((error as Error | undefined)?.message).toContain(
      'does not resolve against the loaded API description',
    );

    const suggestions = (
      (error as { options?: { suggestions?: string[] } }).options
        ?.suggestions ?? []
    ).join('\n');

    expect(suggestions).toContain('stale.ts');
    expect(suggestions).toContain('export "stale"');
    expect(suggestions).toContain('Did you mean one of these selectors?');
    expect(suggestions).toContain(`"${LAUNCHES}"`);
  });

  it('reports every unresolved hook, not just the first', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'one.ts',
      `import { beforeEach } from '@thymian/hooks';
export const a = beforeEach('GET /gone -> 200 (application/json)', () => {});
`,
    );
    await harness.writeHook(
      'two.ts',
      `import { beforeEach } from '@thymian/hooks';
export const b = beforeEach('GET /also-gone -> 200 (application/json)', () => {});
`,
    );

    let error: unknown;

    try {
      await harness.beginRun(format);
    } catch (e) {
      error = e;
    }

    expect((error as Error | undefined)?.message).toContain('2 sampler hooks');

    const suggestions = (
      (error as { options?: { suggestions?: string[] } }).options
        ?.suggestions ?? []
    ).join('\n');

    expect(suggestions).toContain('one.ts');
    expect(suggestions).toContain('two.ts');
  });

  it('runs with no hooks directory at all', async () => {
    const harness = await sampler();

    await harness.loadFormat(format);

    await expect(
      harness.beforeRequest(transactionIdOf(LAUNCHES), format),
    ).resolves.toBeDefined();
  });

  it('surfaces a hook file that cannot be imported, naming the file', async () => {
    const harness = await sampler();

    await harness.writeHook('broken.ts', 'this is not typescript(((\n');

    // A file that cannot be imported is not a hook that fails to resolve: the
    // scan itself could not finish, so it fails when the format is published
    // rather than when a run starts.
    await expect(harness.loadFormat(format)).rejects.toThrowError(
      /"broken\.ts" could not be imported/,
    );
  });
});

describe('which files the loader keeps', () => {
  it('keeps the six module extensions and skips declaration files', () => {
    for (const name of [
      'hook.ts',
      'hook.js',
      'hook.mjs',
      'hook.cjs',
      'hook.mts',
      'hook.cts',
    ]) {
      expect(isHookFile(name), name).toBe(true);
    }

    for (const name of [
      'types.d.ts',
      // Case-insensitively, because a hand-written declaration file handed to
      // the transpiler fails on its own `declare module` syntax.
      'types.D.ts',
      'types.d.mts',
      'hook.tsx',
      'notes.md',
      'schema.json',
    ]) {
      expect(isHookFile(name), name).toBe(false);
    }
  });
});
