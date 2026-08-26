// AC5 fixture: a real .ts plugin, loaded through the BUILT, globally
// installed `thymian` CLI, via the shared resolveUserModule/loadUserModule
// seam — no build step, no Node flags.
export default {
  plugin: async () => undefined,
  name: 'e2e-ts-plugin',
  // A semver *range* of compatible @thymian/core versions, not this
  // plugin's own version — '*' matches whatever version is installed.
  version: '*',
};
