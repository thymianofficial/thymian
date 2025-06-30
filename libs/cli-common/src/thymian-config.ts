export interface ThymianPluginConfiguration<Options> {
  path?: string;
  verbose?: boolean;
  autoload?: boolean;
  options?: Options;
}

export interface ThymianConfig {
  autoload?: boolean;
  plugins: Record<string, ThymianPluginConfiguration<unknown>>;
}
