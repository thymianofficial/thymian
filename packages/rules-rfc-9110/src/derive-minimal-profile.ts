import type {
  CoverageContext,
  CoverageEntry,
  CoverageRecord,
  RulesConfiguration,
} from '@thymian/core';

// `minimal` (thymianofficial/thymian-workspace#60, #64): the package-boundary
// decision defined it as error severity plus at least one declared context
// that is exactly observable -- not heuristic, not impossible -- and the
// retro-tag sweep ruled it derived from the coverage record, never
// transcribed, so this is one function instead of a list of ~90 rule names
// that would drift the moment a batch's cells changed.
//
// Reads `record.rules`' own stamp (`declared.severity`/`declared.types`),
// not a loaded `Rule`'s live `meta`: a profile is static data assembled at
// module load, and `loadRules` is async, so there is nothing else this could
// read synchronously. The stamp is what `checkCoverage`'s own
// stamp-mismatch assertion keeps honest against the real rule.
export function deriveMinimalProfile(
  record: CoverageRecord,
): RulesConfiguration {
  const config: RulesConfiguration = {};

  for (const [name, entry] of Object.entries(record.rules)) {
    if (qualifiesForMinimal(entry)) {
      // Baseline severity is already 'error' for every qualifying rule (the
      // stamp says so); no override needed, which is what keeps this a
      // pure exception list rather than a second transcription of the
      // corpus.
      continue;
    }
    config[name] = 'off';
  }

  return config;
}

function qualifiesForMinimal(entry: CoverageEntry): boolean {
  if (entry.declared.severity !== 'error') {
    return false;
  }

  // The informational branch's `types` is always exactly `['informational']`
  // and its `contexts` is always absent; reading through as a plain string
  // array sidesteps having to narrow the union by hand.
  const types: readonly string[] = entry.declared.types;
  if (types.includes('informational')) {
    return false;
  }

  // A declared context defaults to exactly observable; only an explicit
  // 'heuristic' cell (never written by this corpus today, but a real,
  // legal value) overrides that for one context. One exactly-observable
  // declared context is enough to qualify.
  return types.some(
    (context) => entry.contexts?.[context as CoverageContext] !== 'heuristic',
  );
}
