import { dirname } from 'node:path';

import { mkdir, writeFile } from 'fs/promises';

const [targetMd] = process.argv.slice(2);

if (!targetMd) {
  console.error('Usage: node generate-rule-tags-docs.js <target-md-path>');
  process.exit(1);
}

console.log('Generating concern tag reference docs');

try {
  const { ruleTagVocabulary, ruleTagDescriptions } =
    await import('@thymian/core');

  const sections = Object.entries(ruleTagVocabulary).map(
    ([category, members]) => {
      const rows = members
        .map((member) => {
          const tag = `${category}:${member}`;
          return `| \`${tag}\` | ${ruleTagDescriptions[tag]} |`;
        })
        .join('\n');

      return `## ${category}\n\n| Tag | Description |\n| --- | --- |\n${rows}`;
    },
  );

  const md = `---
title: Concern Tags
description: The closed vocabulary of concern tags a rule can carry.
---

Generated from \`ruleTagDescriptions\` in \`@thymian/core\`. A rule's own tag is always fully
qualified and terminal (\`category:member\`); a bare category is only a legal *pattern* for
matching against tags, never a legal tag on a rule.

${sections.join('\n\n')}
`;

  await mkdir(dirname(targetMd), { recursive: true });
  await writeFile(targetMd, md);

  console.log('Generated concern tag reference docs at', targetMd);
} catch (error) {
  console.error('Failed to generate concern tag reference docs');
  console.error(error);
  process.exit(1);
}
