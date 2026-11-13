import type { TrafficInput } from '@thymian/core';

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
