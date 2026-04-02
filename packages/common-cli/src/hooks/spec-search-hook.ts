import type { SpecificationInput } from '@thymian/core';

declare module '@oclif/core/interfaces' {
  interface Hooks {
    'thymian.spec-search': {
      options: ThymianSpecSearchOptions;
      return: ThymianSpecSearchResult;
    };
  }
}

export type ThymianSpecSearchOptions = {
  cwd: string;
};

export interface ThymianSpecSearchResult {
  pluginName: string;
  specifications: SpecificationInput[];
}

export type ThymianSpecSearchHook = (
  options: ThymianSpecSearchOptions,
) => Promise<ThymianSpecSearchResult>;
