import { isAbsolute, join } from 'node:path';

export type SamplerPaths = {
  /** The per-sampler root, `<cwd>/.thymian/sampler` by default. */
  root: string;
  /** The committed type surface. Regenerated wholesale. */
  generatedDir: string;
  /** The recursive hook tree the loader scans. */
  hooksDir: string;
  /** The tsconfig `init` scaffolds once and thereafter never touches. */
  tsconfigPath: string;
};

/**
 * The single source of truth for every sampler path.
 *
 * `path` is the plugin option. It named the v1 samples tree, which no longer
 * exists; it now names the sampler root, so a project that kept its sampler
 * somewhere other than `.thymian/sampler` keeps one option to say so.
 */
export function resolveSamplerPaths(cwd: string, path?: string): SamplerPaths {
  const root = path
    ? isAbsolute(path)
      ? path
      : join(cwd, path)
    : join(cwd, '.thymian', 'sampler');

  return {
    root,
    generatedDir: join(root, 'generated'),
    hooksDir: join(root, 'hooks'),
    tsconfigPath: join(root, 'tsconfig.json'),
  };
}
