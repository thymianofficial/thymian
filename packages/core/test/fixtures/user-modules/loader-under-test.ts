// The loader instance the TEST is exercising, handed to fixtures through `globalThis`.
//
// A fixture must NOT do `import { loadUserModule } from '../../../src/load-user-module.js'`. That
// specifier is resolved and loaded by **jiti**, whose registry is separate from the one Vitest used
// for the test file, so the fixture receives a SECOND copy of the seam — its own in-flight map, its
// own evaluation chain, its own wait-for graph. Measured: the two `loadUserModule` functions are not
// `===`. Anything a fixture then proves, it proves about the copy.
//
// That mattered. It is why a concurrent-cycle deadlock in the real module could sit behind a green
// cycle test, and why reverting the fix left that test green until the fixtures were switched over.
export type UserModuleLoader = (
  resolvedPath: string,
) => Promise<Record<string, unknown>>;

export function loaderUnderTest(): UserModuleLoader {
  const injected = (
    globalThis as { __thymianLoadUserModule?: UserModuleLoader }
  ).__thymianLoadUserModule;

  if (injected === undefined) {
    throw new Error(
      'Fixture needs globalThis.__thymianLoadUserModule set to the loadUserModule under test.',
    );
  }

  return injected;
}
