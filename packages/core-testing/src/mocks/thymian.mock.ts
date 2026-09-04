import { EventEmitter } from 'node:events';

import { vi } from 'vitest';

/**
 * Shared `@thymian/core` mock for oclif command tests (extracted from the
 * formerly duplicated `convert.test.ts`/`merge.test.ts` blocks, #507 review):
 * replaces `Thymian` with a stub whose `reportConvert` records its input in
 * {@link mockState} and returns {@link mockState.reportConvertResult} (or an
 * empty clean outcome). Test files must still call `vi.mock` themselves
 * (it is hoisted per file), with a factory that returns
 * {@link mockThymianCore}:
 *
 * ```ts
 * vi.mock('@thymian/core', async () =>
 *   (await import('@thymian/core-testing/mocks/thymian')).mockThymianCore(),
 * );
 * ```
 */
export const mockState: {
  reportConvertInput?: unknown;
  reportConvertResult?: unknown;
  runCalled?: boolean;
} = {};

export function resetMockState(): void {
  mockState.reportConvertInput = undefined;
  mockState.reportConvertResult = undefined;
  mockState.runCalled = false;
}

export async function mockThymianCore(): Promise<object> {
  const actual =
    await vi.importActual<typeof import('@thymian/core')>('@thymian/core');

  class MockThymian {
    emitter = new EventEmitter();
    static DEFAULT_TIMEOUT = 30_000;
    static DEFAULT_IDLE_TIMEOUT = 5_000;

    public ready = vi.fn(async () => undefined);
    public close = vi.fn(async () => undefined);
    public register = vi.fn();
    public run = vi.fn(async (fn: () => Promise<unknown>) => {
      // Recorded here, not in reportConvert: `runCalled` asserts the command
      // went through the thymian.run(...) lifecycle wrapper, so bypassing it
      // must fail the assertion.
      mockState.runCalled = true;
      return fn();
    });
    public reportConvert = vi.fn(async (input: unknown) => {
      mockState.reportConvertInput = input;
      return (
        mockState.reportConvertResult ?? {
          report: actual.createReport([]),
          unclaimed: [],
        }
      );
    });
  }

  return {
    ...actual,
    Thymian: MockThymian,
  };
}
