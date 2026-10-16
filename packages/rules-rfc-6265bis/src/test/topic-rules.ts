// For the tests that hold a topic's rules to "one defect, one violation":
// load every executable rule of one topic directory, and run them over the
// same Set-Cookie lines in one context to see which of them report.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Rule } from '@thymian/core';

import { type Origin, SECURE, setCookieInputsAt } from './builders.js';
import { type FixtureContext, runInContext } from './harness.js';

// Every `*.rule.ts` in `dir`, informational rules left out: they run in no
// context.
export async function loadTopicRules(dir: string): Promise<Rule[]> {
  const rules = await Promise.all(
    readdirSync(dir)
      .filter((file) => file.endsWith('.rule.ts'))
      .sort()
      .map(
        async (file) =>
          (
            (await import(pathToFileURL(join(dir, file)).href)) as {
              default: Rule;
            }
          ).default,
      ),
  );
  return rules.filter((rule) => !rule.meta.type.includes('informational'));
}

// The names of the rules that report a violation on `lines`, all sent on one
// response to a request served from `origin`, sorted.
export async function reportedBy(
  rules: Rule[],
  context: FixtureContext,
  lines: string[],
  origin: Origin = SECURE,
): Promise<string[]> {
  const names: string[] = [];
  for (const rule of rules.filter((r) => r.meta.type.includes(context))) {
    const results = await runInContext(
      context,
      rule,
      setCookieInputsAt(origin, lines)[context],
    );
    if (results.some((result) => result.violation !== undefined)) {
      names.push(rule.meta.name);
    }
  }
  return names.sort();
}
