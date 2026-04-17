import { writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  captureEmittedEvents,
  createMockEmitter,
  createMockLogger,
} from '@thymian/core-testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHarPlugin } from '../src/index.js';

describe('plugin-har', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'plugin-har-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function createValidHar(entries: unknown[] = []) {
    return JSON.stringify({ log: { version: '1.2', entries } });
  }

  const validEntry = {
    request: {
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [{ name: 'Accept', value: 'application/json' }],
    },
    response: {
      status: 200,
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      content: { text: '{"id":1}', size: 8 },
    },
    time: 42,
  };

  it('should ignore non-har type inputs and not reply', async () => {
    const plugin = createHarPlugin();
    const emitter = createMockEmitter();
    const logger = createMockLogger();

    await plugin.plugin(emitter, logger, { cwd: tmpDir });

    const replied = vi.fn();

    // Simulate the action handler by calling it directly
    // Get the registered handler
    const onActionCalls = vi.mocked(emitter.onAction).mock.calls;
    const trafficLoadHandler = onActionCalls.find(
      (call) => call[0] === 'core.traffic.load',
    );
    expect(trafficLoadHandler).toBeDefined();

    const handler = trafficLoadHandler![1];
    await handler(
      { inputs: [{ type: 'openapi', location: '/some/file.yaml' }] },
      { reply: replied } as any,
    );

    expect(replied).not.toHaveBeenCalled();
  });

  it('should read HAR file and reply with transactions', async () => {
    const harFile = join(tmpDir, 'test.har');
    await writeFile(harFile, createValidHar([validEntry]));

    const plugin = createHarPlugin();
    const emitter = createMockEmitter();
    const logger = createMockLogger();

    await plugin.plugin(emitter, logger, { cwd: tmpDir });

    const onActionCalls = vi.mocked(emitter.onAction).mock.calls;
    const handler = onActionCalls.find(
      (call) => call[0] === 'core.traffic.load',
    )![1];

    const replied = vi.fn();
    await handler({ inputs: [{ type: 'har', location: harFile }] }, {
      reply: replied,
    } as any);

    expect(replied).toHaveBeenCalledWith({
      transactions: [
        expect.objectContaining({
          request: expect.objectContaining({
            data: expect.objectContaining({
              method: 'get',
              origin: 'https://api.example.com',
              path: '/users',
            }),
          }),
        }),
      ],
    });
  });

  it('should handle malformed JSON and emit core.error', async () => {
    const harFile = join(tmpDir, 'bad.har');
    await writeFile(harFile, 'not-json{{{');

    const plugin = createHarPlugin();
    const emitter = createMockEmitter();
    const logger = createMockLogger();
    const events = captureEmittedEvents(emitter);

    await plugin.plugin(emitter, logger, { cwd: tmpDir });

    const onActionCalls = vi.mocked(emitter.onAction).mock.calls;
    const handler = onActionCalls.find(
      (call) => call[0] === 'core.traffic.load',
    )![1];

    const replied = vi.fn();
    await handler({ inputs: [{ type: 'har', location: harFile }] }, {
      reply: replied,
    } as any);

    expect(events.some(([name]) => name === 'core.error')).toBe(true);
    expect(replied).toHaveBeenCalledWith({ transactions: [] });
  });

  it('should emit core.error for valid JSON but invalid HAR structure', async () => {
    const harFile = join(tmpDir, 'not-har.har');
    await writeFile(harFile, JSON.stringify({ foo: 'bar' }));

    const plugin = createHarPlugin();
    const emitter = createMockEmitter();
    const logger = createMockLogger();
    const events = captureEmittedEvents(emitter);

    await plugin.plugin(emitter, logger, { cwd: tmpDir });

    const onActionCalls = vi.mocked(emitter.onAction).mock.calls;
    const handler = onActionCalls.find(
      (call) => call[0] === 'core.traffic.load',
    )![1];

    const replied = vi.fn();
    await handler({ inputs: [{ type: 'har', location: harFile }] }, {
      reply: replied,
    } as any);

    const errorEvent = events.find(([name]) => name === 'core.error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent![1].message).toContain('Invalid HAR structure');
    expect(replied).toHaveBeenCalledWith({ transactions: [] });
  });

  it('should handle empty HAR file with zero entries', async () => {
    const harFile = join(tmpDir, 'empty.har');
    await writeFile(harFile, createValidHar([]));

    const plugin = createHarPlugin();
    const emitter = createMockEmitter();
    const logger = createMockLogger();

    await plugin.plugin(emitter, logger, { cwd: tmpDir });

    const onActionCalls = vi.mocked(emitter.onAction).mock.calls;
    const handler = onActionCalls.find(
      (call) => call[0] === 'core.traffic.load',
    )![1];

    const replied = vi.fn();
    await handler({ inputs: [{ type: 'har', location: harFile }] }, {
      reply: replied,
    } as any);

    expect(replied).toHaveBeenCalledWith({ transactions: [] });
  });

  it('should resolve relative paths against CWD', async () => {
    const harFile = join(tmpDir, 'relative.har');
    await writeFile(harFile, createValidHar([validEntry]));

    const plugin = createHarPlugin();
    const emitter = createMockEmitter();
    const logger = createMockLogger();

    await plugin.plugin(emitter, logger, { cwd: tmpDir });

    const onActionCalls = vi.mocked(emitter.onAction).mock.calls;
    const handler = onActionCalls.find(
      (call) => call[0] === 'core.traffic.load',
    )![1];

    const replied = vi.fn();
    await handler({ inputs: [{ type: 'har', location: 'relative.har' }] }, {
      reply: replied,
    } as any);

    expect(replied).toHaveBeenCalledWith({
      transactions: [expect.any(Object)],
    });
  });

  it('should skip entries without responses and log warning', async () => {
    const har = createValidHar([
      validEntry,
      {
        request: {
          method: 'GET',
          url: 'https://example.com/no-response',
          headers: [],
        },
        time: 0,
      },
    ]);
    const harFile = join(tmpDir, 'partial.har');
    await writeFile(harFile, har);

    const plugin = createHarPlugin();
    const emitter = createMockEmitter();
    const logger = createMockLogger();

    await plugin.plugin(emitter, logger, { cwd: tmpDir });

    const onActionCalls = vi.mocked(emitter.onAction).mock.calls;
    const handler = onActionCalls.find(
      (call) => call[0] === 'core.traffic.load',
    )![1];

    const replied = vi.fn();
    await handler({ inputs: [{ type: 'har', location: harFile }] }, {
      reply: replied,
    } as any);

    expect(replied).toHaveBeenCalledWith({
      transactions: [expect.any(Object)],
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipped 1 HAR entry without response'),
    );
  });

  it('should reject HAR files exceeding maxFileSize', async () => {
    const harFile = join(tmpDir, 'large.har');
    await writeFile(harFile, createValidHar([validEntry]));

    const plugin = createHarPlugin();
    const emitter = createMockEmitter();
    const logger = createMockLogger();
    const events = captureEmittedEvents(emitter);

    // Set maxFileSize to 1 byte so any real file exceeds it
    await plugin.plugin(emitter, logger, { cwd: tmpDir, maxFileSize: 1 });

    const onActionCalls = vi.mocked(emitter.onAction).mock.calls;
    const handler = onActionCalls.find(
      (call) => call[0] === 'core.traffic.load',
    )![1];

    const replied = vi.fn();
    await handler({ inputs: [{ type: 'har', location: harFile }] }, {
      reply: replied,
    } as any);

    const errorEvent = events.find(([name]) => name === 'core.error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent![1].message).toContain('exceeds maximum size');
    expect(replied).toHaveBeenCalledWith({ transactions: [] });
  });
});
