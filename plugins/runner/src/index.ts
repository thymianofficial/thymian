import { type ThymianPlugin } from '@thymian/core';

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
