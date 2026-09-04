import type { Command } from '@oclif/core';
import type { ReportInput } from '@thymian/core';
import { describe, expect, it, vi } from 'vitest';

import { enforceReportClaims } from '../src/report-claim-enforcement.js';

/**
 * Owned unit coverage for the extracted claim-enforcement module (#507
 * review): every message branch is asserted here, so the oclif command tests
 * only need one integration case each.
 */

interface RaisedError extends Error {
  options?: { exit?: number; suggestions?: string[] };
}

function makeCommand() {
  const error = vi.fn((message: string, options?: object): never => {
    throw Object.assign(new Error(message), { options }) as RaisedError;
  });

  return { command: { error } as unknown as Pick<Command, 'error'>, error };
}

function raised(fn: () => void): RaisedError {
  try {
    fn();
  } catch (err) {
    return err as RaisedError;
  }
  throw new Error('expected enforceReportClaims to error');
}

const input = (type: string, location: string): ReportInput => ({
  type,
  location,
});

describe('enforceReportClaims', () => {
  it('returns silently when nothing went unclaimed', () => {
    const { command, error } = makeCommand();

    enforceReportClaims(command, [input('spectral', './a.json')], []);

    expect(error).not.toHaveBeenCalled();
  });

  it('shows the no-claimant hint when nothing at all was claimed', () => {
    const { command } = makeCommand();
    const reports = [input('foo', './a.json'), input('bar', './b.json')];

    const err = raised(() => enforceReportClaims(command, reports, reports));

    expect(err.message).toBe(
      'No converter plugin claimed any report input ("foo:./a.json", "bar:./b.json").',
    );
    expect(err.options?.exit).toBe(2);
    expect(err.options?.suggestions).toEqual([
      'Is a converter plugin (e.g. @thymian/plugin-spectral) installed and autoloaded?',
    ]);
  });

  it('names a single unclaimed input of an unsupported type with singular wording', () => {
    const { command } = makeCommand();

    const err = raised(() =>
      enforceReportClaims(
        command,
        [input('spectral', './claimed.json'), input('foo', './a.json')],
        [input('foo', './a.json')],
      ),
    );

    expect(err.message).toBe(
      'No registered plugin claims report input "foo:./a.json". Supported report types in this run: spectral.',
    );
    expect(err.options?.exit).toBe(2);
  });

  it('names several unclaimed inputs of unsupported types with plural wording', () => {
    const { command } = makeCommand();

    const err = raised(() =>
      enforceReportClaims(
        command,
        [
          input('spectral', './claimed.json'),
          input('foo', './a.json'),
          input('bar', './b.json'),
        ],
        [input('foo', './a.json'), input('bar', './b.json')],
      ),
    );

    expect(err.message).toBe(
      'No registered plugin claims report inputs "foo:./a.json", "bar:./b.json". Supported report types in this run: spectral.',
    );
  });

  it('distinguishes a single unclaimed input of a supported type (singular wording)', () => {
    const { command } = makeCommand();

    const err = raised(() =>
      enforceReportClaims(
        command,
        [
          input('thymian', './claimed.json'),
          input('thymian', './missing.json'),
        ],
        [input('thymian', './missing.json')],
      ),
    );

    expect(err.message).toBe(
      'Report input "thymian:./missing.json" has a supported type but was not claimed — check the location. Supported report types in this run: thymian.',
    );
    expect(err.message).not.toContain('No registered plugin claims');
    expect(err.options?.exit).toBe(2);
  });

  it('lists several unclaimed inputs of supported types with plural wording', () => {
    const { command } = makeCommand();

    const err = raised(() =>
      enforceReportClaims(
        command,
        [
          input('thymian', './claimed.json'),
          input('thymian', './m1.json'),
          input('thymian', './m2.json'),
        ],
        [input('thymian', './m1.json'), input('thymian', './m2.json')],
      ),
    );

    expect(err.message).toBe(
      'Report inputs "thymian:./m1.json", "thymian:./m2.json" have a supported type but were not claimed — check the locations. Supported report types in this run: thymian.',
    );
  });

  it('joins both problem kinds when unsupported and supported-but-unclaimed inputs mix', () => {
    const { command } = makeCommand();

    const err = raised(() =>
      enforceReportClaims(
        command,
        [
          input('thymian', './claimed.json'),
          input('foo', './a.json'),
          input('thymian', './missing.json'),
        ],
        [input('foo', './a.json'), input('thymian', './missing.json')],
      ),
    );

    expect(err.message).toBe(
      'No registered plugin claims report input "foo:./a.json". Report input "thymian:./missing.json" has a supported type but was not claimed — check the location. Supported report types in this run: thymian.',
    );
  });

  it('derives the supported list from claimed inputs, de-duplicated per type', () => {
    const { command } = makeCommand();

    const err = raised(() =>
      enforceReportClaims(
        command,
        [
          input('thymian', './a.json'),
          input('thymian', './b.json'),
          input('spectral', './c.json'),
          input('foo', './x.json'),
        ],
        [input('foo', './x.json')],
      ),
    );

    // 'thymian' was claimed twice but appears once; order follows first
    // claimed occurrence.
    expect(err.message).toContain(
      'Supported report types in this run: thymian, spectral.',
    );
  });

  it("treats a same-type input as claimed only when the location matches (a wrong location must not mask the type's support)", () => {
    const { command } = makeCommand();

    // Same type twice: one claimed, one not. The unclaimed one must count as
    // supported-but-unclaimed — not flip the whole type to unsupported.
    const err = raised(() =>
      enforceReportClaims(
        command,
        [input('spectral', './ok.json'), input('spectral', './typo.json')],
        [input('spectral', './typo.json')],
      ),
    );

    expect(err.message).toContain(
      'Report input "spectral:./typo.json" has a supported type but was not claimed',
    );
  });
});
