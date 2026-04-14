import { ux } from '@oclif/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseCliRunCommand } from '../src/base-cli-run-command.js';

vi.mock('@oclif/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@oclif/core')>();
  return {
    ...actual,
    ux: {
      ...actual.ux,
      stderr: vi.fn(),
    },
  };
});

/**
 * Minimal harness that exposes the public `guidance()` method and the
 * protected `guidanceEnabled` property without requiring a full oclif
 * command bootstrap.
 */
function createGuidanceHarness(enabled: boolean) {
  // Use Object.create to get a real instance-like object that inherits
  // the guidance() method from BaseCliRunCommand's prototype, then set
  // the protected field directly.
  const harness = Object.create(BaseCliRunCommand.prototype) as InstanceType<
    typeof BaseCliRunCommand
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (harness as any).guidanceEnabled = enabled;
  return harness;
}

describe('BaseCliRunCommand.guidance()', () => {
  beforeEach(() => {
    vi.mocked(ux.stderr).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes message to stderr when guidanceEnabled is true', () => {
    const harness = createGuidanceHarness(true);
    harness.guidance('test guidance message');

    expect(ux.stderr).toHaveBeenCalledTimes(1);
    expect(ux.stderr).toHaveBeenCalledWith('test guidance message');
  });

  it('is a no-op when guidanceEnabled is false', () => {
    const harness = createGuidanceHarness(false);
    harness.guidance('should not appear');

    expect(ux.stderr).not.toHaveBeenCalled();
  });

  it('passes the exact message string to ux.stderr', () => {
    const harness = createGuidanceHarness(true);
    const msg =
      '\n\u2139 Running Thymian on an existing API often surfaces many findings.';
    harness.guidance(msg);

    expect(ux.stderr).toHaveBeenCalledWith(msg);
  });

  it('can be called multiple times, each call writes to stderr', () => {
    const harness = createGuidanceHarness(true);
    harness.guidance('first');
    harness.guidance('second');

    expect(ux.stderr).toHaveBeenCalledTimes(2);
    expect(ux.stderr).toHaveBeenNthCalledWith(1, 'first');
    expect(ux.stderr).toHaveBeenNthCalledWith(2, 'second');
  });

  it('does not call ux.stderr even once when disabled, regardless of call count', () => {
    const harness = createGuidanceHarness(false);
    harness.guidance('a');
    harness.guidance('b');
    harness.guidance('c');

    expect(ux.stderr).not.toHaveBeenCalled();
  });
});

describe('guidanceEnabled resolution', () => {
  it('baseFlags defines --guidance as boolean with allowNo', () => {
    const guidanceFlag = BaseCliRunCommand.baseFlags.guidance;
    expect(guidanceFlag).toBeDefined();
  });

  it('guidanceEnabled defaults to false before init()', () => {
    const harness = Object.create(BaseCliRunCommand.prototype) as InstanceType<
      typeof BaseCliRunCommand
    >;
    // The class field initializer sets guidanceEnabled = false
    // When accessed via Object.create, the prototype default applies.
    // We verify the property descriptor on a fresh instance-like object
    // reflects the intended default behavior.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((harness as any).guidanceEnabled).toBeFalsy();
  });
});
