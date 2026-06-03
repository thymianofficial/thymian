import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { corePlugin } from '../src/core-plugin.js';
import { SchemaRegistry } from '../src/emitter/schema-registry.js';
import { ThymianEmitter } from '../src/emitter/thymian-emitter.js';
import { NoopLogger } from '../src/logger/noop.logger.js';
import { ThymianBaseError } from '../src/thymian.error.js';

function buildEmitter(
  mode: 'off' | 'warn' | 'throw',
  registry = new SchemaRegistry(),
  { registerCore = true } = {},
) {
  if (registerCore) {
    registry.register(corePlugin);
  }

  const warnings: string[] = [];
  const logger = Object.assign(new NoopLogger(), {
    warn: (msg: string) => warnings.push(msg),
  });

  const emitter = new ThymianEmitter(
    logger,
    {
      completed: new Set(),
      errors: new Subject(),
      events: new Subject(),
      listeners: new Map(),
      responses: new Subject(),
      source: '@thymian/core',
    },
    {
      strictPayloads: mode,
      schemaRegistry: registry,
    },
  );

  return { emitter, warnings };
}

describe('ThymianEmitter strictPayloads', () => {
  it('warns when an emitted event payload contains a class instance', () => {
    const { emitter, warnings } = buildEmitter('warn');

    // `core.register` is declared in core-plugin's events.provides.
    // Embedding a class instance in the payload should be caught.
    emitter.emit('core.register', {
      name: 'demo',
      options: { err: new ThymianBaseError('boom') },
      events: {},
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/event "core\.register"/);
    expect(warnings[0]).toMatch(/class-instance|builtin|Error/);
  });

  it('throws in throw mode when an emitted payload fails the probe', () => {
    const { emitter } = buildEmitter('throw');

    expect(() =>
      emitter.emit('core.register', {
        name: 'demo',
        options: { err: new ThymianBaseError('boom') },
        events: {},
      }),
    ).toThrow(/strict-payloads/);
  });

  it('does nothing in off mode', () => {
    const { emitter, warnings } = buildEmitter('off');

    emitter.emit('core.register', {
      name: 'demo',
      options: { err: new ThymianBaseError('boom') },
      events: {},
    });

    expect(warnings).toHaveLength(0);
  });

  it('probes serializability even when no schema is declared for the payload', () => {
    const { emitter, warnings } = buildEmitter('warn', new SchemaRegistry(), {
      registerCore: false,
    });

    emitter.emit('core.report', {
      sections: [{ bad: () => 'fn' }],
    } as unknown as never);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/not-serializable|function/);
  });

  it('passes through serializable payloads matching the schema', () => {
    const { emitter, warnings } = buildEmitter('warn');

    emitter.emit('core.report', {
      source: 'test',
      message: 'all good',
      sections: [],
    } as unknown as never);

    expect(warnings).toEqual([]);
  });
});
