import { type ThymianEmitter, type ThymianPlugin } from '@thymian/core';

export const runnerPlugin: ThymianPlugin<{ arg: number }> = {
  plugin: async (emitter: ThymianEmitter, _logger, { arg }) => {
    emitter.on('thymian.start', () => {
      emitter.emit('run', arg);
    });
  },
  name: '@thymian/runner',
  version: '*',
  options: {},
  events: {
    emits: {},
    listens: ['thymian.start'],
  },
};

export default runnerPlugin;
