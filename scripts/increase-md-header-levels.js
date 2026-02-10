#!/usr/bin/env node

import fs from 'node:fs/promises';

import { glob } from 'tinyglobby';

console.log('Increase md header levels');
console.log('#########################\n');

const searchPatterns = process.argv.slice(2);

if (searchPatterns.length === 0) {
  console.log('Use like this:');
  console.log(
    'increase-md-header-levels.js path/pattern/1.md [path/pattern/2.md] [...]',
  );
  process.exit(1);
}

const files = await glob(searchPatterns);
console.log('Adjusting the following files:', files);

for await (const file of files) {
  try {
    const fileBuffer = await fs.readFile(file, 'utf8');

    const content = fileBuffer.toString();

    // increase all headings (lines starting with '# [SOME TEXT]') but ignore everything in code blocks
    const parts = content.split(/(^```[\s\S]*?^```)/gm);
    const processedParts = parts.map((part) => {
      if (part.startsWith('```')) {
        return part;
      }
      return part.replaceAll(/^(#+ \S.*)$/gm, '#$1');
    });

    const contentWithIncreasedHeaderLevels = processedParts.join('');

    await fs.writeFile(file, contentWithIncreasedHeaderLevels, 'utf8');
  } catch (err) {
    console.error(err);
  }
}

console.log('Finished increasing md header levels');
