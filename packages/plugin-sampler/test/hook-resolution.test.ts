import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { HttpRequestTemplate } from '@thymian/core';
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
