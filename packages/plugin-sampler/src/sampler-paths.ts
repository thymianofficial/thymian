import { join } from 'node:path';

export type SamplerPaths = {
  /** `<cwd>/.thymian/sampler` */
  root: string;
  /** Where 575.10's `init`/`sync` writes the generated type surface. */
  generatedDir: string;
  /** The recursive hook tree this story's loader scans. */
  hooksDir: string;
  /** The tsconfig 575.10 generates so an editor can see the generated types. */
  tsconfigPath: string;
};

/**
 * The single source of truth for every v2 sampler path (spec §2: *"All sampler
 * paths derive from one helper."*). 575.10 consumes it for `init` / `sync` /
 * `validate`.
 *
 * Deliberately **not** wired to `SamplerPluginOptions.path`. That option still
 * means the **v1 samples tree** (default `.thymian/samples`), which
 * `sampler.path-from-transaction`, `sampler init` and `sampler validate` depend on
 * until 575.10, and story 575.1 explicitly requires its `basePath` resolution be
 * preserved. Making the v2 root configurable means a new plugin option, an
 * options-schema change and a `generate-schema-docs` regeneration that 575.10 would
 * immediately rework — so it is wired once, there.
 */
export function resolveSamplerPaths(cwd: string): SamplerPaths {
  const root = join(cwd, '.thymian', 'sampler');

  return {
    root,
    generatedDir: join(root, 'generated'),
    hooksDir: join(root, 'hooks'),
    tsconfigPath: join(root, 'tsconfig.json'),
  };
}
