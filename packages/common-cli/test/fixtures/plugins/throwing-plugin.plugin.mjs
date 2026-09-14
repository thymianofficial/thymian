// Fixture: throws a real Error at module evaluation time (not caught by
// the seam — `loadUserModule` only frames *unloadable-kind* errors, so this
// propagates to the plugin loader's own catch).
throw new Error('boom during plugin evaluation');
