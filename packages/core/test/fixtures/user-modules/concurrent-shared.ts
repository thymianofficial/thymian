// Fixture: a dependency two concurrent roots both wait for — the shape that must NOT be reported
// as a cycle, and the reason cycle detection cannot simply refuse every cross-root wait. Counts its
// own evaluations on `globalThis` (not module scope) so the test can still see the count when the
// module is, correctly, evaluated only once.
const globals = globalThis as { __thymianSharedEvaluations?: number };

globals.__thymianSharedEvaluations =
  (globals.__thymianSharedEvaluations ?? 0) + 1;

export default { evaluations: globals.__thymianSharedEvaluations };
