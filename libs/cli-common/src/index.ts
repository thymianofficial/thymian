// idea to run oclif hook to allow each plugin to create their configuration by its own
declare module '@oclif/core/interfaces' {
  interface Hooks {
    'thymian-plugin.init': {
      options: undefined;
      return: string;
    };
  }
}

export * from './base-cli-command.js';
export * from './default-config.js';
export * as oclif from './oclif.js';
export * from './read-plugins.js';
export * from './thymian-config.js';
export * as yaml from './yaml.js';
