import { type ThymianListerAsyncFn, type ThymianPlugin } from '@thymian/core';

declare module '@thymian/core' {
  interface ThymianEmitter {
    onHook<T>(
      event: `beforeAll.${number}`,
      listener: ThymianListerAsyncFn<T>
    ): void;
  }
}

export const runnerPlugin: ThymianPlugin<{ arg: number }> = {
  plugin: async () => undefined,
  name: '@thymian/runner',
  version: '*',
  options: {},
  hooks: {},
  events: {
    emits: {},
    listens: ['thymian.start'],
  },
};

export default runnerPlugin;
