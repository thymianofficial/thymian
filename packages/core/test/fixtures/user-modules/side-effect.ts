// Fixture: records every evaluation on a global counter, so a test can prove the module's
// top-level body runs exactly once even when several callers load it concurrently.
interface Counter {
  sideEffectLoads?: number;
}

const counter: Counter = globalThis;

counter.sideEffectLoads = (counter.sideEffectLoads ?? 0) + 1;

export default counter.sideEffectLoads;
