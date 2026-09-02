import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  createHttpRequest,
  createHttpResponse,
  createThymianFormatWithTransactions,
} from '@thymian/core-testing';
import { afterEach, describe, expect, it } from 'vitest';

import { type SamplerHarness, startSampler } from './plugin-harness.js';
import { listTree } from './utils.js';

/**
 * #15: `init` is optional DX setup. It writes the committed type surface and
 * scaffolds a tsconfig — once — and it is never required for hooks to run.
 */
describe('sampler init', () => {
  const harnesses: SamplerHarness[] = [];

  async function sampler(): Promise<SamplerHarness> {
    const harness = await startSampler();
    harnesses.push(harness);
    return harness;
  }

  afterEach(async () => {
    await Promise.all(harnesses.splice(0).map((h) => h.dispose()));
  });

  const FIXTURE = createThymianFormatWithTransactions([
    [
      createHttpRequest({ method: 'GET', path: '/launches' }),
      createHttpResponse({ statusCode: 200, mediaType: 'application/json' }),
    ],
  ]);

  it('scaffolds the root, the generated surface and a tsconfig', async () => {
    const harness = await sampler();

    await harness.loadFormat(FIXTURE);

    const result = await harness.init();

    expect(result.generated).toEqual(['hooks-api.d.ts', 'request-types.d.ts']);
    expect(result.tsconfig).toBe('written');
    await expect(listTree(harness.cwd)).resolves.toEqual([
      '.thymian/sampler/generated/hooks-api.d.ts',
      '.thymian/sampler/generated/request-types.d.ts',
      '.thymian/sampler/tsconfig.json',
    ]);
  });

  it('says what the user has to do to their own tsconfig', async () => {
    const harness = await sampler();

    await harness.loadFormat(FIXTURE);

    const { rootExcludeNote } = await harness.init();

    expect(rootExcludeNote.join('\n')).toContain('"exclude"');
    expect(rootExcludeNote.join('\n')).toContain('.thymian/sampler');
  });

  it('never overwrites a tsconfig the user has edited', async () => {
    const harness = await sampler();

    await harness.loadFormat(FIXTURE);
    await harness.init();

    const tsconfigPath = join(
      harness.cwd,
      '.thymian',
      'sampler',
      'tsconfig.json',
    );
    const edited = '{ "compilerOptions": { "types": ["node", "vitest"] } }\n';

    await writeFile(tsconfigPath, edited, 'utf-8');

    const again = await harness.init();

    expect(again.tsconfig).toBe('kept');
    await expect(readFile(tsconfigPath, 'utf-8')).resolves.toBe(edited);
  });

  it('regenerates the generated directory wholesale', async () => {
    const harness = await sampler();

    await harness.loadFormat(FIXTURE);
    await harness.init();

    const orphan = join(
      harness.cwd,
      '.thymian',
      'sampler',
      'generated',
      'from-an-older-version.d.ts',
    );

    await writeFile(orphan, 'export type Gone = never;\n', 'utf-8');
    await harness.init();

    // A file left over from a description that no longer has that shape is
    // exactly the stale artifact the virtual model exists to remove.
    await expect(listTree(harness.cwd)).resolves.not.toContain(
      '.thymian/sampler/generated/from-an-older-version.d.ts',
    );
  });

  it('produces a byte-identical surface when run again from nothing', async () => {
    const first = await sampler();
    const second = await sampler();

    await first.loadFormat(FIXTURE);
    await second.loadFormat(FIXTURE);
    await first.init();
    await second.init();

    for (const file of ['hooks-api.d.ts', 'request-types.d.ts']) {
      const path = join('.thymian', 'sampler', 'generated', file);

      await expect(readFile(join(second.cwd, path), 'utf-8')).resolves.toBe(
        await readFile(join(first.cwd, path), 'utf-8'),
      );
    }
  });

  it('is not required for a hook to fire', async () => {
    const harness = await sampler();

    await harness.writeHook(
      'hook.ts',
      `import { beforeEach } from '@thymian/hooks';

export const shape = beforeEach(
  'GET /launches -> 200 (application/json)',
  (request) => {
    request.headers['x-no-init'] = 'yes';
  },
);
`,
    );

    await harness.loadFormat(FIXTURE);

    const [transaction] = FIXTURE.getThymianHttpTransactions();

    if (!transaction) {
      throw new Error('fixture has no transaction');
    }

    const { result } = await harness.beforeRequest(
      transaction.transactionId,
      FIXTURE,
    );

    expect(result.headers['x-no-init']).toBe('yes');
    // And nothing was generated on the way.
    await expect(listTree(harness.cwd)).resolves.toEqual([
      '.thymian/sampler/hooks/hook.ts',
    ]);
  });
});
