import type { ThymianPluginConfiguration } from './thymian-config.js';

declare module '@oclif/core/interfaces' {
  interface Hooks {
    'thymian-plugin.init': {
      options: ThymianPluginInitOptions;
      return: ThymianPluginInitResult;
    };
  }
}

export type ThymianPluginInitOptions = {
  cwd: string;
};

export type ThymianPluginInitResult<T = unknown> = {
  pluginName: string;
  configuration: ThymianPluginConfiguration<T>;
  include: boolean;
};

export type ThymianPluginInitHook<T = unknown> = (
  options: ThymianPluginInitOptions
) => Promise<ThymianPluginInitResult<T>>;
