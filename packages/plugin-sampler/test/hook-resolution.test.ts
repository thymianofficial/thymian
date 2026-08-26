import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { type HttpRequestTemplate, ThymianBaseError } from '@thymian/core';
import { createThymianFormatWithTransactions } from '@thymian/core-testing';
import { afterAll, describe, expect, it } from 'vitest';

import {
  hookResolutionError,
  loadUserHooks,
  type LoadUserHooksResult,
} from '../src/hooks/load-user-hooks.js';
import { TransactionCatalog } from '../src/selectors/transaction-catalog.js';
import { createTempDir } from './utils.js';

const format = createThymianFormatWithTransactions(3);
const catalog = TransactionCatalog.fromThymianFormat(format);
const selectors = catalog.selectors();
const [selectorA, selectorB, selectorC] = selectors;

if (!selectorA || !selectorB || !selectorC) {
  throw new Error('fixture format must render three selectors');
}

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function writeHooks(files: Record<string, string>): Promise<string> {
  const root = await createTempDir('.tmp-sampler-resolve-');
  roots.push(root);

  const hooksDir = join(root, '.thymian', 'sampler', 'hooks');
  await mkdir(hooksDir, { recursive: true });

  for (const [relative, content] of Object.entries(files)) {
    const full = join(hooksDir, relative);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, 'utf-8');
  }

  return hooksDir;
}

function idOf(selector: string): string {
  const transaction = catalog.tryResolve(selector);

  if (!transaction) {
    throw new Error(`fixture selector ${selector} must resolve`);
  }

  return transaction.transactionId;
}

function errorsOf(result: LoadUserHooksResult) {
  return result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
}

const template = { path: '' } as unknown as HttpRequestTemplate;

async function tagFor(
  result: LoadUserHooksResult,
  selector: string,
): Promise<string | undefined> {
  const hooks = result.perTransaction.get(idOf(selector));

  if (!hooks?.authorize) {
    return undefined;
  }

  const value = await hooks.authorize(template, undefined, undefined as never);

  return (value as { path: string }).path;
}

describe('target resolution', () => {
  it('reports a dangling selector, naming the file and the selector', async () => {
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const gone = beforeEach('GET /renamed -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const [error] = errorsOf(result);

    expect(result.hasErrors).toBe(true);
    expect(error?.file).toBe('auth.ts');
    expect(error?.kind).toBe('beforeEach');
    expect(error?.anchor).toBe('"GET /renamed -> 200"');
    expect(error?.exportName).toBe('gone');
    expect(error?.reason).toContain('GET /renamed -> 200');
    // Suggestions come from 575.2's catalog. Advice, never a rebinding.
    expect(error?.suggestions?.length ?? 0).toBeGreaterThan(0);
    expect(result.perTransaction.size).toBe(0);
  });

  it('never auto-rebinds a dangling selector to a near miss', async () => {
    const hooksDir = await writeHooks({
      'near.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        // Same path and method as transaction 0, wrong status.
        `export const near = beforeEach('GET /transaction-0 -> 404', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(result.perTransaction.size).toBe(0);
  });

  it('resolves a selector list and reports only the members that dangle', async () => {
    const hooksDir = await writeHooks({
      'list.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const some = beforeEach([`,
        `  ${JSON.stringify(selectorA)},`,
        `  'GET /nope -> 200',`,
        `  ${JSON.stringify(selectorB)},`,
        `], async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const [error] = errorsOf(result);

    expect(error?.reason).toContain('1 of 3 selector(s) do not resolve');
    expect(error?.reason).toContain('GET /nope -> 200');
    // A partially resolving list binds nothing: half a hook is not a hook.
    expect(result.perTransaction.size).toBe(0);
  });

  it('binds every member of a fully resolving selector list', async () => {
    const hooksDir = await writeHooks({
      'list.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const both = beforeEach([`,
        `  ${JSON.stringify(selectorA)},`,
        `  ${JSON.stringify(selectorC)},`,
        `], async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect([...result.perTransaction.keys()].sort()).toEqual(
      [idOf(selectorA), idOf(selectorC)].sort(),
    );
  });

  it('rejects an empty selector list as vacuous', async () => {
    const hooksDir = await writeHooks({
      'empty.ts': [
        `import { afterEach } from '@thymian/hooks';`,
        `export const none = afterEach([], async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)[0]?.reason).toContain('empty selector list');
  });

  it('rejects a filter that matches zero transactions', async () => {
    const hooksDir = await writeHooks({
      'filter.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const byTag = beforeEach({ statusClass: '2xx' }, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const [error] = errorsOf(result);

    expect(error?.anchor).toBe('{"statusClass":"2xx"}');
    expect(error?.reason).toContain('matched none of the 3 loaded transaction');
    expect(result.perTransaction.size).toBe(0);
  });
});

describe('conflicts', () => {
  it('makes defineSample set-once and names both files', async () => {
    const hooksDir = await writeHooks({
      'first.ts': [
        `import { defineSample } from '@thymian/hooks';`,
        `export const one = defineSample(${JSON.stringify(selectorA)}, (d) => d);`,
        ``,
      ].join('\n'),
      'second.ts': [
        `import { defineSample } from '@thymian/hooks';`,
        `export const two = defineSample(${JSON.stringify(selectorA)}, (d) => d);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const [error] = errorsOf(result);

    expect(errorsOf(result)).toHaveLength(1);
    // The later file carries the diagnostic; the earlier one is named in it.
    expect(error?.file).toBe('second.ts');
    expect(error?.reason).toContain('first.ts');
    expect(error?.reason).toContain('one');
    // The first definition still stands; the second is refused.
    expect(result.sampleDefinitions.size).toBe(1);
  });

  it('accepts one defineSample per transaction', async () => {
    const hooksDir = await writeHooks({
      'samples.ts': [
        `import { defineSample } from '@thymian/hooks';`,
        `export const a = defineSample(${JSON.stringify(selectorA)}, (d) => d);`,
        `export const b = defineSample(${JSON.stringify(selectorB)}, (d) => d);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect([...result.sampleDefinitions.keys()].sort()).toEqual(
      [idOf(selectorA), idOf(selectorB)].sort(),
    );
  });

  it('does not see a phantom duplicate when one defineSample is exported twice', async () => {
    const hooksDir = await writeHooks({
      'aliased.ts': [
        `import { defineSample } from '@thymian/hooks';`,
        `const shared = defineSample(${JSON.stringify(selectorA)}, (d) => d);`,
        `export default shared;`,
        `export const alias = shared;`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(result.sampleDefinitions.size).toBe(1);
  });

  it('lets a targeted authorize win while the global covers the rest', async () => {
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (v) => ({ ...v, path: 'global' }));`,
        `export const justA = authorize(${JSON.stringify(selectorA)}, async (v) => ({ ...v, path: 'targeted' }));`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(await tagFor(result, selectorA)).toBe('targeted');
    expect(await tagFor(result, selectorB)).toBe('global');
    expect(await tagFor(result, selectorC)).toBe('global');
  });

  it('binds the global authorize to every transaction when there is no targeted one', async () => {
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (v) => ({ ...v, path: 'global' }));`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    for (const selector of selectors) {
      expect(await tagFor(result, selector)).toBe('global');
    }
  });

  it('never widens a targeted authorize into a global one', async () => {
    // `SELECTORS.login` is `undefined` after a rename. The load must not bind
    // this hook to all three transactions and call it clean.
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `const SELECTORS = {};`,
        `export const login = authorize(SELECTORS.login, async (v) => ({ ...v, path: 'escalated' }));`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(true);
    expect(result.boundHookCount).toBe(0);

    for (const selector of selectors) {
      expect(await tagFor(result, selector)).toBeUndefined();
    }
  });

  it('rejects two global authorize hooks, naming both files', async () => {
    const hooksDir = await writeHooks({
      'a-global.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const first = authorize(async (v) => v);`,
        ``,
      ].join('\n'),
      'b-global.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const second = authorize(async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const [error] = errorsOf(result);

    expect(errorsOf(result)).toHaveLength(1);
    expect(error?.file).toBe('b-global.ts');
    expect(error?.anchor).toBe('global');
    expect(error?.reason).toContain('a-global.ts');
  });

  it('rejects two targeted authorize hooks that overlap one transaction', async () => {
    const hooksDir = await writeHooks({
      'a-target.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const first = authorize([${JSON.stringify(selectorA)}, ${JSON.stringify(selectorB)}], async (v) => v);`,
        ``,
      ].join('\n'),
      'b-target.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const second = authorize(${JSON.stringify(selectorB)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const [error] = errorsOf(result);

    expect(errorsOf(result)).toHaveLength(1);
    expect(error?.file).toBe('b-target.ts');
    expect(error?.reason).toContain('a-target.ts');
    // The non-overlapping transaction is untouched by the conflict.
    expect(result.perTransaction.get(idOf(selectorA))?.authorize).toBeDefined();
  });

  it('accepts two targeted authorize hooks that do not overlap', async () => {
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const a = authorize(${JSON.stringify(selectorA)}, async (v) => ({ ...v, path: 'a' }));`,
        `export const b = authorize(${JSON.stringify(selectorB)}, async (v) => ({ ...v, path: 'b' }));`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(await tagFor(result, selectorA)).toBe('a');
    expect(await tagFor(result, selectorB)).toBe('b');
    expect(await tagFor(result, selectorC)).toBeUndefined();
  });
});

describe('aggregation', () => {
  it('reports every broken hook, not just the first', async () => {
    const hooksDir = await writeHooks({
      'one.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const a = beforeEach('GET /gone-one -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
      'two.ts': [
        `import { afterEach } from '@thymian/hooks';`,
        `export const b = afterEach('GET /gone-two -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
      'three.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const c = authorize('GET /gone-three -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toHaveLength(3);

    const message = hookResolutionError(result.diagnostics).message;

    // One error, three lines — not three edit-run cycles.
    expect(message).toContain('3 sampler hook problem(s)');
    expect(message).toContain('one.ts');
    expect(message).toContain('two.ts');
    expect(message).toContain('three.ts');
    expect(message).toContain('GET /gone-one -> 200');
    expect(message).toContain('GET /gone-two -> 200');
    expect(message).toContain('GET /gone-three -> 200');
  });

  it('keeps one error to one line, even a multi-line import failure', async () => {
    // `formatDiagnostic` interpolated `reason` verbatim, and jiti's `ParseError`
    // carries a newline plus an absolute path — so line 2 of the aggregated
    // message was a bare unindented `/private/var/…/a-broken.ts:1:17`, breaking
    // out of the `"  ${line}"` list the docblock promises is one per line.
    const hooksDir = await writeHooks({
      'a-broken.ts': 'export const x = ;\n',
      'b-dangling.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach('GET /nope -> 200', async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const lines = hookResolutionError(result.diagnostics).message.split('\n');

    expect(errorsOf(result)).toHaveLength(2);
    // One header line plus exactly one line per error.
    expect(lines).toHaveLength(3);

    for (const line of lines.slice(1)) {
      expect(line.startsWith('  ')).toBe(true);
      expect(line.trim().startsWith('/')).toBe(false);
    }

    expect(lines[1]).toContain('a-broken.ts: could not be imported');
    expect(lines[1]).toContain('ParseError');
  });

  it('names the error `HookResolutionError` and sets no dangling `ref`', async () => {
    const error = hookResolutionError([
      {
        severity: 'error',
        file: 'a.ts',
        kind: 'beforeEach',
        anchor: '"GET /x -> 200"',
        reason: 'nope',
      },
    ]);

    expect(error.name).toBe('HookResolutionError');
    expect(error.options.ref).toBeUndefined();
    expect(error.message).toContain('a.ts: beforeEach "GET /x -> 200" — nope');
  });
});

describe('a duplicate selector inside one target array', () => {
  it('does not make a defineSample conflict with itself', async () => {
    const hooksDir = await writeHooks({
      'dup.ts': [
        `import { defineSample } from '@thymian/hooks';`,
        `export const s = defineSample(`,
        `  [${JSON.stringify(selectorA)}, ${JSON.stringify(selectorA)}],`,
        `  (d) => d,`,
        `);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // Undeduped, the second pass over the same transaction found the first as
    // its owner and reported `that transaction's sample is already set by "s" in
    // "dup.ts"` — naming the export as its own rival, in the file the user is
    // looking at, with no second hook anywhere.
    expect(errorsOf(result)).toEqual([]);
    expect(result.sampleDefinitions.size).toBe(1);
  });

  it('does not make a targeted authorize conflict with itself', async () => {
    const hooksDir = await writeHooks({
      'dup.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const a = authorize(`,
        `  [${JSON.stringify(selectorA)}, ${JSON.stringify(selectorA)}],`,
        `  async (v) => ({ ...v, path: 'targeted' }),`,
        `);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toEqual([]);
    expect(await tagFor(result, selectorA)).toBe('targeted');
  });

  it('binds a beforeEach once, not once per repeat', async () => {
    const hooksDir = await writeHooks({
      'dup.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(`,
        `  [${JSON.stringify(selectorA)}, ${JSON.stringify(selectorA)}],`,
        `  async (value) => ({ ...value, path: value.path + 'x' }),`,
        `);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const hooks = result.perTransaction.get(idOf(selectorA));

    // `beforeEach`/`afterEach` have no owner check, so the duplicate was pushed
    // twice and ran twice per request — with no diagnostic at all.
    expect(hooks?.beforeEach).toHaveLength(1);
  });

  it('reports the number of transactions bound, not the number of selectors', async () => {
    const hooksDir = await writeHooks({
      'dup.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(`,
        `  [${JSON.stringify(selectorA)}, ${JSON.stringify(selectorA)}],`,
        `  async (value) => value,`,
        `);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const info = result.diagnostics.find((d) => d.kind === 'beforeEach');

    expect(info?.reason).toBe('resolved to 1 transaction(s)');
  });
});

describe('a global authorize is reported like every other bound hook', () => {
  it('emits an info diagnostic and counts toward the summary', async () => {
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // The global branch returned before `resolve()`, so a hook that is bound and
    // will run produced `diagnostics: []` — and 575.10's `validate`, which
    // renders this array, would have shown nothing for it.
    const info = result.diagnostics.find((d) => d.kind === 'authorize');

    expect(info?.severity).toBe('info');
    expect(info?.file).toBe('auth.ts');
    expect(info?.exportName).toBe('everywhere');
    expect(info?.anchor).toBe('global');
    expect(info?.reason).toBe(`resolved to ${catalog.size} transaction(s)`);
    expect(result.diagnostics.at(-1)?.reason).toBe(
      `1 hook target(s) resolved against ${catalog.size} transaction(s)`,
    );
  });

  it('reports the reach the global actually has, with targeted hooks subtracted', async () => {
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (v) => v);`,
        `export const justA = authorize(${JSON.stringify(selectorA)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);
    const global = result.diagnostics.find((d) => d.anchor === 'global');

    expect(global?.reason).toBe(
      `resolved to ${catalog.size - 1} transaction(s)`,
    );
  });

  it('counts one hook, not one per transaction in the catalog', async () => {
    const hooksDir = await writeHooks({
      'auth.ts': [
        `import { authorize } from '@thymian/hooks';`,
        `export const everywhere = authorize(async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    // `perTransaction.size` is the *catalog* size here, because precedence is
    // decided at load time for every transaction. Reporting it as a hook count
    // told an operator with a 240-transaction API that 240 hooks had loaded.
    expect(result.perTransaction.size).toBe(catalog.size);
    expect(result.boundHookCount).toBe(1);
  });
});

describe('a resolution error that is not a ThymianError', () => {
  it('becomes a diagnostic instead of crashing the loader', async () => {
    // `isThymianError` explicitly accepts a value with **no own `options`**
    // (`thymian.error.ts:20-32`), so `isThymianError(new Error('x'))` is `true`
    // and `error.options.suggestions` is a `TypeError` — thrown from inside the
    // catch block that exists to turn the failure into a diagnostic. Latent only
    // while `TransactionCatalog.resolve` throws `ThymianBaseError` exclusively;
    // the 575.4 filter seam lives in the same function.
    const hostileCatalog = {
      size: 1,
      entries: () => [],
      resolve: () => {
        throw new TypeError('the matcher blew up');
      },
      tryResolve: () => undefined,
      selectors: () => [],
    } as unknown as TransactionCatalog;

    const hooksDir = await writeHooks({
      'h.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, hostileCatalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result)[0]?.reason).toContain('the matcher blew up');
    expect(errorsOf(result)[0]?.suggestions).toBeUndefined();
  });
});

/**
 * Every transformation the resolution path applies to the user's **target**
 * value, with a fixture that crosses each one.
 *
 * `hook-api.ts` stores `target` verbatim and `snapshotRegistration` copies the
 * reference, so the frozen snapshot freezes the registration's *fields*, not the
 * target's *value*. `targetOf` then hands the live user object to
 * `describeTarget` and `resolveTargeting`, where `Array.isArray`, `.length` and
 * the `for…of` iteration all used to run outside any `try` — so one exotic
 * target escaped `loadUserHooks` as an unformatted error with no `file:`
 * attribution, breaking both "never throws for user error" and AC 6's "one
 * broken file must not hide the other nine".
 */
describe('an exotic target value on the resolution path', () => {
  const cases: [
    name: string,
    source: string,
    marker: string,
    anchor: string,
  ][] = [
    [
      'a revoked Proxy, which throws from `Array.isArray` itself',
      [
        `const revocable = Proxy.revocable([], {});`,
        `revocable.revoke();`,
        `export const h = beforeEach(revocable.proxy, async (v) => v);`,
      ].join('\n'),
      'revoked',
      // `Array.isArray` throws before any branch of the renderer runs.
      '[unprintable target]',
    ],
    [
      'a Proxy array whose `length` read throws',
      [
        `export const h = beforeEach(new Proxy([], {`,
        `  get(t, k, r) {`,
        `    if (k === 'length') { throw new Error('boom-length'); }`,
        `    return Reflect.get(t, k, r);`,
        `  },`,
        `}), async (v) => v);`,
      ].join('\n'),
      'boom-length',
      // `map` reads `length` first, so the renderer's own list guard catches it.
      '[unprintable selector list]',
    ],
    [
      'a Proxy array whose element read throws',
      [
        `export const h = beforeEach(new Proxy(['x'], {`,
        `  get(t, k, r) {`,
        `    if (k === '0') { throw new Error('boom-element'); }`,
        `    return Reflect.get(t, k, r);`,
        `  },`,
        `}), async (v) => v);`,
      ].join('\n'),
      'boom-element',
      '[unprintable selector list]',
    ],
  ];

  it.each(cases)(
    'becomes a diagnostic: %s',
    async (_name, source, marker, anchor) => {
      const hooksDir = await writeHooks({
        'h.ts': [
          `import { beforeEach } from '@thymian/hooks';`,
          source,
          ``,
        ].join('\n'),
      });

      const result = await loadUserHooks(hooksDir, catalog);

      expect(result.hasErrors).toBe(true);
      expect(errorsOf(result)).toHaveLength(1);
      // Attributed to the file that wrote it, like every other user-value
      // failure.
      expect(errorsOf(result)[0]?.file).toBe('h.ts');
      expect(errorsOf(result)[0]?.kind).toBe('beforeEach');
      expect(errorsOf(result)[0]?.reason).toContain(marker);
      // Each fallback label of `describeTarget` is reached by exactly one of
      // these fixtures; nothing in the suite used to reach any of them.
      expect(errorsOf(result)[0]?.anchor).toBe(anchor);
    },
  );

  it('renders `[unprintable filter]` for a circular filter target', async () => {
    // The filter-branch fallback of `describeTarget`. Reachable and correct, but
    // never reached by the suite: `safeString` handles the nearest case before
    // the `JSON.stringify` guard matters.
    const hooksDir = await writeHooks({
      'h.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const filter = {};`,
        `filter.self = filter;`,
        `export const h = beforeEach(filter, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)[0]?.anchor).toBe('[unprintable filter]');
    expect(errorsOf(result)[0]?.reason).toContain('matched none');
  });

  it('drops a suggestion list that is not all strings', async () => {
    // `hookResolutionError` joins `suggestions` into the one message a user
    // sees, so a non-string element would be rendered into it. The element-wise
    // check is what stops that, and nothing used to catch its removal.
    const hostileCatalog = {
      size: 1,
      entries: () => [],
      resolve: () => {
        throw new ThymianBaseError('nope', {
          name: 'SelectorNotFoundError',
          suggestions: ['a real suggestion', 42] as unknown as string[],
        });
      },
      tryResolve: () => undefined,
      selectors: () => [],
    } as unknown as TransactionCatalog;

    const hooksDir = await writeHooks({
      'h.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, hostileCatalog);

    expect(errorsOf(result)[0]?.suggestions).toBeUndefined();
    expect(hookResolutionError(result.diagnostics).options.suggestions).toEqual(
      [],
    );
  });

  it('ignores a hostile `Symbol.iterator`: nothing iterates a user array', async () => {
    // Round 3 pinned this as a *diagnostic*: `resolveTargeting` used `for…of`,
    // which ran the trap, and the outer guard turned the throw into
    // `boom-iterator`. Round 4 reads a selector list by index — `length`, then
    // `[0]`, `[1]`, … — so the iterator protocol is never entered and a hostile
    // one costs the user nothing at all. That is strictly better than reporting
    // it, so the assertion moves up rather than away: the hook resolves and
    // binds, and no diagnostic is raised.
    const hooksDir = await writeHooks({
      'h.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const list = new Proxy([${JSON.stringify(selectorA)}], {`,
        `  get(t, k, r) {`,
        `    if (k === Symbol.iterator) { throw new Error('boom-iterator'); }`,
        `    return Reflect.get(t, k, r);`,
        `  },`,
        `});`,
        `export const h = beforeEach(list, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(result.hasErrors).toBe(false);
    expect(result.boundHookCount).toBe(1);
  });

  it('renders an anchor for a target `describeTarget` cannot read', async () => {
    // `describeTarget` runs *before* `resolveTargeting`, to build the anchor of
    // the diagnostic that reports the failure. `Array.isArray` throws on a
    // revoked Proxy before any of its branches — and before its inner guards.
    const hooksDir = await writeHooks({
      'h.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const revocable = Proxy.revocable([], {});`,
        `revocable.revoke();`,
        `export const h = beforeEach(revocable.proxy, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)[0]?.anchor).toBe('[unprintable target]');
  });

  it('costs the user the one file, not the whole scan', async () => {
    // AC 6: one broken file must not hide the other nine. The bad file sorts
    // first, so a throw out of the binding loop took both healthy files with it.
    const hooksDir = await writeHooks({
      'aaa-bad.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `const revocable = Proxy.revocable([], {});`,
        `revocable.revoke();`,
        `export const bad = beforeEach(revocable.proxy, async (v) => v);`,
        ``,
      ].join('\n'),
      'bbb-good.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const good = beforeEach(${JSON.stringify(selectorB)}, async (v) => v);`,
        ``,
      ].join('\n'),
      'ccc-good.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const good = beforeEach(${JSON.stringify(selectorC)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, catalog);

    expect(errorsOf(result)).toHaveLength(1);
    expect(errorsOf(result)[0]?.file).toBe('aaa-bad.ts');
    expect(result.boundHookCount).toBe(2);
    expect(result.perTransaction.get(idOf(selectorB))?.beforeEach).toHaveLength(
      1,
    );
    expect(result.perTransaction.get(idOf(selectorC))?.beforeEach).toHaveLength(
      1,
    );
  });

  it('survives a hostile error object thrown out of resolution', async () => {
    // The guard must not itself throw while reading the error it is reporting:
    // `suggestionsOf` reads `error.options?.suggestions`, and `?.` does not
    // protect against a getter that throws.
    const hostileCatalog = {
      size: 1,
      entries: () => [],
      resolve: () => {
        throw new Proxy(new Error('hostile'), {
          get(target, key, receiver) {
            if (key === 'options') {
              throw new Error('even the error fights back');
            }

            return Reflect.get(target, key, receiver);
          },
        });
      },
      tryResolve: () => undefined,
      selectors: () => [],
    } as unknown as TransactionCatalog;

    const hooksDir = await writeHooks({
      'h.ts': [
        `import { beforeEach } from '@thymian/hooks';`,
        `export const h = beforeEach(${JSON.stringify(selectorA)}, async (v) => v);`,
        ``,
      ].join('\n'),
    });

    const result = await loadUserHooks(hooksDir, hostileCatalog);

    expect(result.hasErrors).toBe(true);
    expect(errorsOf(result)[0]?.file).toBe('h.ts');
    // The user reads the reason their hook failed — `hostile` — not the reason
    // the *reporter* failed. Without a guard inside `suggestionsOf` the throw
    // escapes its own catch block, and the outer guard then overwrites the real
    // diagnosis with `could not be resolved — …`.
    expect(errorsOf(result)[0]?.reason).toBe('hostile');
    expect(errorsOf(result)[0]?.suggestions).toBeUndefined();
  });
});
