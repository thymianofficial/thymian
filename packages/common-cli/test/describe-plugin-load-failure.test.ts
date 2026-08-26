import { describe, expect, it } from 'vitest';

import { describePluginLoadFailure } from '../src/describe-plugin-load-failure.js';

describe('describePluginLoadFailure', () => {
  it('names a missing-module error by its message, with import-specific suggestions', () => {
    const error = new Error("Cannot find module './helper.js'") as Error & {
      code: string;
    };
    error.code = 'MODULE_NOT_FOUND';

    const described = describePluginLoadFailure(error);

    expect(described.reason).toContain("Cannot find module './helper.js'");
    expect(described.suggestions.join(' ')).toMatch(/import/i);
  });

  it('surfaces a plain thrown Error message as the reason (evaluation-time throw)', () => {
    const described = describePluginLoadFailure(
      new Error('boom during plugin evaluation'),
    );

    expect(described.reason).toBe('boom during plugin evaluation');
  });

  it('does NOT give export-shape advice for a load-time (non-module-not-found) failure', () => {
    // Regression guard for P1: an evaluation throw / syntax error must not be
    // met with "use export default / module.exports" — the module already ran,
    // so export shape is irrelevant and the advice misdirects.
    const described = describePluginLoadFailure(
      new Error('boom during plugin evaluation'),
    );

    const text = described.suggestions.join(' ');
    expect(text).not.toMatch(/export default|module\.exports/);
    expect(text).toMatch(
      /imports resolve|valid TypeScript|underlying message/i,
    );
  });

  it('unwraps error.cause to find a wrapped module-not-found code', () => {
    // jiti / Node ESM commonly wrap: the outer error has a generic message and
    // no code, the real MODULE_NOT_FOUND sits on `.cause`. The import-specific
    // branch must still fire.
    const inner = new Error("Cannot find module './missing.js'") as Error & {
      code: string;
    };
    inner.code = 'ERR_MODULE_NOT_FOUND';
    const wrapper = new Error('Failed to load plugin', { cause: inner });

    const described = describePluginLoadFailure(wrapper);

    expect(described.suggestions.join(' ')).toMatch(/import/i);
    // The reason must name the inner "Cannot find module …" message, not the
    // generic outer wrapper — otherwise the real cause stays hidden.
    expect(described.reason).toContain("Cannot find module './missing.js'");
    expect(described.reason).not.toContain('Failed to load plugin');
  });

  it('never returns an empty reason for an opaque/unresolvable error', () => {
    // A non-Error thrown value with no message and no code — the case the
    // epic calls out explicitly: "unresolvable plugins get their own
    // reason, not an empty one".
    const described = describePluginLoadFailure({});

    expect(described.reason).not.toBe('');
    expect(described.reason.length).toBeGreaterThan(0);
  });

  it('never returns an empty reason for an Error with an empty message', () => {
    const described = describePluginLoadFailure(new Error(''));

    expect(described.reason).not.toBe('');
  });

  it('always returns at least one suggestion', () => {
    const described = describePluginLoadFailure(new Error('anything'));

    expect(described.suggestions.length).toBeGreaterThan(0);
  });
});
