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
 *   (await import('../../helpers/mock-thymian.js')).mockThymianCore(),
 * );
 * ```
 */
export const mockState: {
  reportConvertInput?: unknown;
  reportConvertResult?: unknown;
  reportDiffInput?: unknown;
  reportDiffResult?: unknown;
  runCalled?: boolean;
} = {};

export function resetMockState(): void {
  mockState.reportConvertInput = undefined;
  mockState.reportConvertResult = undefined;
  mockState.reportDiffInput = undefined;
  mockState.reportDiffResult = undefined;
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
    public reportDiff = vi.fn(async (input: unknown) => {
      mockState.reportDiffInput = input;
      return (
        mockState.reportDiffResult ?? {
          diff: actual.createReportDiff(
            { reportId: 'mock-base', createdAt: '2026-01-01T00:00:00.000Z' },
            { reportId: 'mock-head', createdAt: '2026-01-02T00:00:00.000Z' },
            [],
          ),
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
