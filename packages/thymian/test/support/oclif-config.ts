import { Config } from '@oclif/core';

/**
 * Load the oclif config once, to be passed to every `Command.run(argv, config)`
 * in a test file.
 *
 * `Command.run(argv)` without a config runs `Config.load()` on every call, a
 * full plugin and command scan that costs over a second on Windows CI and
 * pushed tests past their timeout. Given a loaded config, oclif reuses its
 * plugins instead. The root is oclif's default, the one `Command.run(argv)`
 * falls back to, so what gets loaded is unchanged.
 */
export function loadOclifConfig(): Promise<Config> {
  return Config.load();
}
