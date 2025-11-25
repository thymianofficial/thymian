import { EventEmitter } from 'node:events';
import { join } from 'node:path';

import { captureOutput } from '@oclif/test';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';

process.env.OCLIF_TEST_ROOT = join(import.meta.url, '../../..');

const mockState: {
  instance?: unknown;
  closed?: boolean;
} = {};

vi.mock('@thymian/core', async () => {
  const actual = await vi.importActual('@thymian/core');

  class MockThymian {
    emitter = new EventEmitter();

    public ready = vi.fn(async () => undefined);
    public close = vi.fn(async () => {
      mockState.closed = true;
    });
  }

  return {
    ...actual,
    Thymian: MockThymian,
  };
});

import Serve from '../../src/commands/serve.js';

describe('serve command', () => {
  let exitSpy: MockInstance<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as () => never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('starts and print information to user', async () => {
    const { stdout } = await captureOutput(async () => {
      await Serve.run(['--no-autoload']);
    });

    expect(stdout).toContain(
      'Thymian is now in "serve" mode. Press "q" to exit.',
    );
  });

  it('closes Thymian and exits process if "q" is pressed', async () => {
    await Serve.run(['--no-autoload']);

    process.stdin.emit('data', Buffer.from('q'));

    await new Promise((r) => setImmediate(r));

    expect(mockState.closed).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it.todo(
    'closes Thymian and exits process if exit event is emitted',
    async () => {
      await Serve.run(['--no-autoload']);

      //mockState.instance?.emitter.emit('core.exit', { code: 5 });

      await new Promise((r) => setImmediate(r));

      expect(mockState.closed).toBe(true);
      expect(exitSpy).toHaveBeenCalledWith(5);
    },
  );

  it('closes Thymian and exits process when SIGINT (Ctrl+C) is pressed', async () => {
    await Serve.run(['--no-autoload']);

    process.emit('SIGINT');

    await new Promise((r) => setImmediate(r));

    expect(mockState.closed).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
