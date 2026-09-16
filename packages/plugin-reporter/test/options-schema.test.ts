import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NoopLogger, ThymianEmitter } from '@thymian/core';
import { ajv, validate } from '@thymian/core/ajv';
import { describe, expect, it } from 'vitest';

import { reporterPlugin } from '../src/index.js';

const { options: schema } = reporterPlugin;

/**
 * The schema is what actually enforces the option contract at config-load time,
 * and it is `additionalProperties: false` at every level — so both halves
 * matter: what still validates, and what no longer does.
 */
function isValid(config: unknown): boolean {
  return schema !== undefined && validate(schema, config);
}

describe('reporter plugin options schema', () => {
  it('accepts a bare formatter selection', () => {
    // Every e2e fixture and the generated default config say `markdown: {}`:
    // formatters carry no options of their own, but selecting one must still
    // validate.
    expect(isValid({ formatters: { markdown: {}, csv: {}, json: {} } })).toBe(
      true,
    );
  });

  it('accepts reportsDir at the plugin level', () => {
    expect(isValid({ reportsDir: 'build/reports' })).toBe(true);
    expect(
      isValid({
        reportsDir: '/absolute/reports',
        formatters: { markdown: {} },
        sortReportsBy: 'rule',
      }),
    ).toBe(true);
  });

  it.each(['markdown', 'csv', 'json'] as const)(
    'rejects the removed per-formatter path option on %s',
    (name) => {
      // The option is gone and the schema does not declare it, so
      // `additionalProperties: false` on the formatter object rejects a stale
      // config at validation time — no plugin code runs, and Ajv's own
      // unexpected-property message is what the user sees.
      expect(isValid({ formatters: { [name]: { path: `out.${name}` } } })).toBe(
        false,
      );
      expect(ajv.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instancePath: `/formatters/${name}`,
            keyword: 'additionalProperties',
            params: expect.objectContaining({ additionalProperty: 'path' }),
          }),
        ]),
      );
    },
  );

  it('rejects a blank reportsDir', () => {
    // `''` validated as a plain string and then resolved to the run working
    // directory itself, dropping timestamped run directories into the user's
    // project root. It fails config validation now.
    expect(isValid({ reportsDir: '' })).toBe(false);
  });

  it('accepts a null reportsDir, which is what a bare YAML key parses to', () => {
    // Not a choice: Ajv's `JSONSchemaType` requires `nullable: true` on every
    // optional property, so `reportsDir: null` validates whatever the schema
    // says about strings — `minLength` only constrains strings. The plugin
    // therefore has to read null as "unset"; see below.
    expect(isValid({ reportsDir: null, formatters: { markdown: {} } })).toBe(
      true,
    );
  });

  it('registers with the null reportsDir the schema admits', async () => {
    // The boundary the schema leaves open: null used to reach
    // `resolveReportsBaseDirectory` and throw a raw TypeError, so registration
    // crashed instead of falling back to the default base.
    const cwd = await mkdtemp(join(tmpdir(), 'thymian-null-reports-dir-'));

    try {
      await reporterPlugin.plugin(new ThymianEmitter(), new NoopLogger(), {
        cwd,
        reportsDir: null,
        formatters: { markdown: {} },
      });

      const base = await stat(join(cwd, '.thymian', 'reports'));

      // Normalized to unset, so the precondition created the default base.
      expect(base.isDirectory()).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('rejects reportsDir nested under a formatter', () => {
    // It is one base for the whole plugin, not a per-formatter destination.
    expect(isValid({ formatters: { markdown: { reportsDir: 'out' } } })).toBe(
      false,
    );
  });
});
