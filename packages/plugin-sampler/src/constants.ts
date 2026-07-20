export const SAMPLE_FILE = /request\.json$/;
export const BEFORE_EACH_HOOK = /(?:^|[/\\.])beforeEach\.[cm]?[jt]s$/;
export const AFTER_EACH_HOOK = /(?:^|[/\\.])afterEach\.[cm]?[jt]s$/;
export const AUTHORIZE_HOOK = /(?:^|[/\\.])authorize\.[cm]?[jt]s$/;

/**
 * Whether a file name is a sampler hook file. This must mirror how hooks are
 * actually discovered when reading samples (see `extractHooksFromDir` in
 * read-samples-from-dir.ts), so that `sampler validate` never flags a file the
 * sampler loads as a hook — the matching lives here to keep the two in sync.
 */
export function isHookFileName(fileName: string): boolean {
  return (
    BEFORE_EACH_HOOK.test(fileName) ||
    AFTER_EACH_HOOK.test(fileName) ||
    AUTHORIZE_HOOK.test(fileName)
  );
}
