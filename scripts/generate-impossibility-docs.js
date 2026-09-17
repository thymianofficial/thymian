import { dirname } from 'node:path';

import { mkdir, writeFile } from 'fs/promises';

const [targetMd] = process.argv.slice(2);

if (!targetMd) {
  console.error('Usage: node generate-impossibility-docs.js <target-md-path>');
  process.exit(1);
}

console.log('Generating impossibility reason reference docs');

try {
  const { tier1ImpossibilityReasons, tier2ImpossibilityReasons } =
    await import('@thymian/core');

  const tier1Rows = Object.entries(tier1ImpossibilityReasons)
    .map(([code, claim]) => `| \`${code}\` | ${claim} |`)
    .join('\n');

  const tier2Rows = Object.entries(tier2ImpossibilityReasons)
    .map(([code, claim]) => `| \`${code}\` | ${claim} |`)
    .join('\n');

  const md = `---
title: Impossibility Reasons
description: The closed vocabulary of reasons a rule, or one context of it, may be unobservable.
---

Generated from \`tier1ImpossibilityReasons\` and \`tier2ImpossibilityReasons\` in
\`@thymian/core\`. \`tool-limitation\` is the only code in both tiers: the distinction it draws
— Thymian's own implementation versus the world — is orthogonal to the distinction between one
context and all of them.

## Tier 1 — whole-rule, in the rule file

These make a rule \`informational\`: a claim about the world that holds in every context,
permanently. Passed as \`.type('informational', reason, note)\`.

| Code | Claim |
| --- | --- |
${tier1Rows}

## Tier 2 — per-context, in the coverage record

These do not make a rule informational — the rule is executable. They record why one
context is missing from it.

| Code | Claim |
| --- | --- |
${tier2Rows}
`;

  await mkdir(dirname(targetMd), { recursive: true });
  await writeFile(targetMd, md);

  console.log('Generated impossibility reason reference docs at', targetMd);
} catch (error) {
  console.error('Failed to generate impossibility reason reference docs');
  console.error(error);
  process.exit(1);
}
