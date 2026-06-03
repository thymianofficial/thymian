import { describe, expect, it } from 'vitest';

import { ThymianFormat } from '../src/format/index.js';
import { NoopLogger } from '../src/logger/noop.logger.js';
import { Thymian } from '../src/thymian.js';

class CapturingLogger extends NoopLogger {
  warnings: string[] = [];
  override warn(msg: unknown): void {
    this.warnings.push(String(msg));
  }
}

describe('strictPayloads against a live core flow', () => {
  it(
    'emits no probe warnings during a vanilla core.lint round-trip',
    { timeout: 30_000 },
    async () => {
      const logger = new CapturingLogger();

      const thymian = new Thymian(logger, { strictPayloads: 'warn' });

      thymian.register({
        name: 'demo',
        version: '0.x',
        plugin: async (emitter) => {
          emitter.onAction('core.lint', (_payload, ctx) => {
            ctx.reply({
              source: 'demo',
              status: 'success',
              violations: [],
            });
          });
        },
      });

      await thymian.run(async () => {
        await thymian.emitter.emitAction('core.lint', {
          format: new ThymianFormat().export(),
          rules: [],
          rulesConfig: {},
        });
      });

      const probeWarnings = logger.warnings.filter((w) =>
        w.includes('[strict-payloads]'),
      );

      expect(probeWarnings).toEqual([]);
    },
  );
});
