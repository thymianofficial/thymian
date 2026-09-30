import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Rule } from '@thymian/core';
import { describe, expect, it } from 'vitest';

import { stsValueInputs } from '../../test/builders.js';
import { fixtureContexts, runInContext } from '../../test/harness.js';

// One defect, one violation: a Strict-Transport-Security value that does not
// parse against §6.1's grammar is reported by the grammar rule alone. Every
// other rule in the syntax topic judges directives, and a value that does not
// parse has none a UA would read — so each is silent, in every context,
// convention rules included once a profile turns them on.

const GRAMMAR_RULE =
  'rfc-6797/hsts-host-must-send-sts-header-conforming-to-grammar';

const syntaxDir = dirname(fileURLToPath(import.meta.url));

const rules: Rule[] = (
  await Promise.all(
    readdirSync(syntaxDir)
      .filter((file) => file.endsWith('.rule.ts'))
      .sort()
      .map(
        async (file) =>
          (
            (await import(pathToFileURL(join(syntaxDir, file)).href)) as {
              default: Rule;
            }
          ).default,
      ),
  )
).filter((rule) => !rule.meta.type.includes('informational'));

// Each would bait a directive-level rule if it were read leniently: a
// repeated max-age, a max-age that is not delta-seconds or has no value, a
// valued includeSubDomains, an unrecognized directive.
const malformed = [
  'max-age=31536000, includeSubDomains',
  'max-age="31536000; includeSubDomains',
  'max-age=1y; max-age; includeSubDomains=yes; includeSubDomain, preload',
];

describe.each(fixtureContexts)('in %s', (context) => {
  it.each(malformed)(
    'reports "%s" once, from the grammar rule',
    async (value) => {
      const reportedBy: string[] = [];
      for (const rule of rules.filter((r) => r.meta.type.includes(context))) {
        const results = await runInContext(
          context,
          rule,
          stsValueInputs(value)[context],
        );
        for (const result of results) {
          if (result.violation !== undefined) {
            reportedBy.push(rule.meta.name);
          }
        }
      }

      expect(reportedBy).toEqual([GRAMMAR_RULE]);
    },
  );
});
