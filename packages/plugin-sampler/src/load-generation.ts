/**
 * One shared "which `core.format` load is current" authority.
 *
 * `HookRunner` and `RequestSampler` each used to keep their own counter,
 * bumped inside their own `init()` — their docblocks called each other "the
 * mirror" of the same guard. That answers "did something interrupt *this*
 * component's own await", which is not the question that decides whether a
 * load should win: three steps run against shared state before either
 * component's `init` is even reached (the transaction catalog build, the v1
 * samples-tree read, and — inside `RequestSampler.init` itself, ahead of
 * `HookRunner.init` — the sample projection), and a per-component counter
 * re-derived *after* those steps no longer reflects which `core.format`
 * event actually fired last. It reflects which one reached that particular
 * line last.
 *
 * Measured: an older event whose samples-tree read was slow finished its own
 * `invalidate()` + capture *after* a newer event had already run to
 * completion — including that newer event's own `invalidate()` calls, which
 * bump the very counter the older event was about to read. The older event's
 * fresh capture picked up the newer event's already-advanced number, found
 * nothing had changed since, and reinstated the stale format over the
 * current one. No amount of guarding *inside* `init()` closes this: the
 * capture itself is happening too late, once per component, at a point that
 * has already drifted from true arrival order.
 *
 * The fix is one authority and one token per `core.format` event, taken
 * **before any of that event's async work starts** — including the samples
 * read that runs ahead of both components — and threaded explicitly through
 * every step that writes state for it. Not derived in `@thymian/core`,
 * which this epic's AC10 keeps unchanged: the plugin is the only thing that
 * knows a `core.format` load has these three dependents, so the plugin is
 * where the one shared token lives.
 */
export class LoadGeneration {
  #current = 0;

  /**
   * Starts a new load and returns its token.
   *
   * Call this exactly once, synchronously, at the point true arrival order
   * must be captured from — before any `await` belonging to this load,
   * including work that runs ahead of every consumer of the token. Passing
   * the returned value down, rather than having each consumer call this
   * again or re-read {@link isCurrent}'s backing state fresh, is what makes
   * every later check answer "is this still the newest load anyone has
   * started" instead of "did anything happen during the specific span I was
   * watching".
   */
  start(): number {
    this.#current += 1;

    return this.#current;
  }

  /** Is `token` still the newest token {@link start} has handed out? */
  isCurrent(token: number): boolean {
    return token === this.#current;
  }
}
