import type { TrafficInput } from '@thymian/core';

declare module '@oclif/core/interfaces' {
  interface Hooks {
    'thymian.traffic-search': {
      options: ThymianTrafficSearchOptions;
      return: ThymianTrafficSearchResult;
    };
  }
}

export type ThymianTrafficSearchOptions = {
  cwd: string;
};

export interface ThymianTrafficSearchResult {
  pluginName: string;
  traffic: TrafficInput[];
}

export type ThymianTrafficSearchHook = (
  options: ThymianTrafficSearchOptions,
) => Promise<ThymianTrafficSearchResult>;
