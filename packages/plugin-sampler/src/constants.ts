export const SAMPLE_FILE = /request\.json$/;
export const BEFORE_EACH_HOOK = /(?:^|[/\\.])beforeEach\.[cm]?[jt]s$/;
export const AFTER_EACH_HOOK = /(?:^|[/\\.])afterEach\.[cm]?[jt]s$/;
export const AUTHORIZE_HOOK = /(?:^|[/\\.])authorize\.[cm]?[jt]s$/;

/**
 * Whether a file name is a **v1** sampler hook file.
 *
 * The only surviving consumer is `sampler validate`
 * (`validation/validate-sampler-output.ts`), which must not flag a leftover v1
 * hook file inside `.thymian/samples` as an unexpected artifact — the e2e case
 * "ignores user hook files in the samples directory" asserts exactly that.
 *
 * It no longer mirrors discovery: story 575.9 removed v1 tree hook discovery
 * entirely, so `extractHooksFromDir` imports nothing and hooks are found only under
 * `.thymian/sampler/hooks/` by `loadUserHooks`. These three patterns describe files
 * `validate` should tolerate, not files the sampler loads. They die in 575.10 with
 * the rest of the tree.
 */
export function isHookFileName(fileName: string): boolean {
  return (
    BEFORE_EACH_HOOK.test(fileName) ||
    AFTER_EACH_HOOK.test(fileName) ||
    AUTHORIZE_HOOK.test(fileName)
  );
}
