import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Rule } from '@thymian/core';
import {
  addTransaction,
  createGetRequest,
  createOkResponse,
  createRequiredParameter,
  createStringSchema,
  createThymianFormat,
} from '@thymian/core-testing';
import { runRule } from '@thymian/rules-testing';
import { describe, expect, it } from 'vitest';

import { STS_HEADER } from '../utils/sts-field-value.js';

// One defect, one violation: a Strict-Transport-Security value that does not
// parse against §6.1's grammar is reported by the grammar rule alone. Every
// other rule in the syntax topic judges directives, and a value that does not
// parse has none a UA would read — so each accepts it, in every context.

const GRAMMAR_RULE =
  'rfc6797/hsts-host-must-send-sts-header-conforming-to-grammar';

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

// The value is pinned by the API description, so the server of `test` sends
// it and the traffic of `analytics` records it without further ado.
describe.each(['static', 'test', 'analytics'] as const)('in %s', (context) => {
  it.each(malformed)(
    'reports "%s" once, from the grammar rule',
    async (value) => {
      const format = createThymianFormat();
      const answered = addTransaction(
        format,
        createGetRequest(),
        createOkResponse({
          headers: {
            [STS_HEADER]: createRequiredParameter({
              schema: createStringSchema({ const: value }),
            }),
          },
        }),
      );

      for (const rule of rules.filter((r) => r.meta.type.includes(context))) {
        expect(
          await runRule(rule)[context](format),
          rule.meta.name,
        ).toMatchObject([
          {
            location: { elementId: answered },
            status: rule.meta.name === GRAMMAR_RULE ? 'failed' : 'passed',
          },
        ]);
      }
    },
  );
});
