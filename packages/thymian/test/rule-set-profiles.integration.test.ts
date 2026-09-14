import { thymianConfigSchema } from '@thymian/common-cli';
import { ajv, formatAjvErrors } from '@thymian/core';
import rulesApiDescriptionValidation from '@thymian/rules-api-description-validation';
import rulesRfc9110 from '@thymian/rules-rfc-9110';
import { describe, expect, it } from 'vitest';

// A profile is a `rules:` block a rule set ships on the user's behalf, so
// everything a profile expresses must also be expressible in a config file.
// This is the one package that depends on the config schema and on every
// shipped rule set at once, which is why the check lives here rather than
// beside either side of it.
const shippedRuleSets = [rulesRfc9110, rulesApiDescriptionValidation];

const shippedProfiles = shippedRuleSets.flatMap((ruleSet) =>
  Object.entries(ruleSet.profiles ?? {}).map(([profile, rules]) => ({
    ruleSet: ruleSet.name,
    profile,
    rules,
  })),
);

describe('shipped rule-set profiles', () => {
  // Guards the `it.each` below against passing vacuously: a rule set that
  // stops exporting its profiles would otherwise leave nothing to check.
  it('finds profiles to check', () => {
    expect(shippedProfiles.length).toBeGreaterThan(0);
  });

  it.each(shippedProfiles)(
    '$ruleSet / $profile is expressible as a config rules block',
    ({ rules }) => {
      const validate = ajv.compile(thymianConfigSchema);

      const valid = validate({ plugins: {}, rules });

      expect(valid, formatAjvErrors(validate.errors).message).toBe(true);
    },
  );
});
