// Fixture: the TypeScript twin of `rules/never-runs.rule.mjs` — a hand-constructed rule object that
// declares an executable type and has no execution function. It exists to reach
// `assertRuleExecutionInvariant` through the jiti path, which is the only way to observe the source
// string that `(loaded from …)` prints. No `@thymian/core` import: the builder would refuse to
// construct this shape.
interface Meta {
  readonly name: string;
  readonly severity: string;
  readonly type: readonly string[];
  readonly tags: readonly string[];
  readonly options: Record<string, never>;
}

const meta: Meta = {
  name: 'never-runs-ts',
  severity: 'error',
  type: ['static'],
  tags: [],
  options: {},
};

export default { meta };
