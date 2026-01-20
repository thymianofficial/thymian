import type { HttpFilterExpression } from '@thymian/core';

export interface ThymianPluginConfiguration<
  Options extends Record<PropertyKey, unknown> = Record<PropertyKey, unknown>,
> {
  path?: string;
  verbose?: boolean;
  autoload?: boolean;
  options?: Options;
}

export interface ThymianConfig {
  autoload?: boolean;
  plugins: Record<string, ThymianPluginConfiguration>;
  filters?: HttpFilterExpression[];
}
