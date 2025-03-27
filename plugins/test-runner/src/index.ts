import {
  ThymianEmitter,
  type ThymianPlugin,
  type Logger,
  type ThymianListerAsyncFn,
} from '@thymian/core';
import type { HttpTest } from './types.js';

declare module '@thymian/core' {
  interface ThymianEmitter {
    onHook<T>(event: ``, listener: ThymianListerAsyncFn<T>): void;
  }
}

export type TestRunnerOptions = unknown;

export const testRunnerPlugin: ThymianPlugin<TestRunnerOptions> = {
  name: '@thymian/test-runner',
  events: {},
  hooks: undefined,
  options: {},
  version: '',
  async plugin(
    emitter: ThymianEmitter,
    logger: Logger,
    options: TestRunnerOptions
  ): Promise<void> {
    emitter.onEvent('test-runner.test', async (test: HttpTest) => {
      logger.debug(`Received test with id ${test.id}`);
    });
  },
};

export default testRunnerPlugin;
