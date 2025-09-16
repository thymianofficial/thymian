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
  interactive: boolean;
};

export type ThymianPluginInitResult<
  T extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = {
  pluginName: string;
  configuration: ThymianPluginConfiguration<T>;
  include: boolean;
};

export type ThymianPluginInitHook<
  T extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>
> = (options: ThymianPluginInitOptions) => Promise<ThymianPluginInitResult<T>>;
