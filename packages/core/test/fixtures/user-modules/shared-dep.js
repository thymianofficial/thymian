// Fixture: a plain-JS dependency shared by a JS rule and a TS rule. Counting evaluations on a
// global proves the two dispatch branches land in ONE module registry, not two.
const counter = globalThis;

counter.sharedDepEvaluations = (counter.sharedDepEvaluations ?? 0) + 1;

export default { evaluation: counter.sharedDepEvaluations };
