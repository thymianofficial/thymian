// idea to run oclif hook to allow each plugin to create their configuration by its own
declare module '@oclif/core/interfaces' {
  interface Hooks {
    'thymian-plugin.init': {
      options: undefined;
      return: string;
    };
  }
}

export * from './base-cli-run-command.js';
export * from './default-config.js';
export * as oclif from './oclif.js';
export * as prompts from './prompts.js';
export * from './read-plugins.js';
export * from './thymian-config.js';
export * as yaml from './yaml.js';
