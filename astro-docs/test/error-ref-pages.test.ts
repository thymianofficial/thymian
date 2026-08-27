import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// `astro-docs` is ESM (`type: "module"`), so resolve this file's directory from
// `import.meta.url` rather than relying on a `__dirname` shim.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Guards that every `ref: 'https://thymian.dev/references/errors/<slug>/'` a
// packages/** source names actually has a matching Errors/<slug>.md page —
// AC8 of story 725.5. Two pre-existing gaps predate this epic and are not
// refs it ships; they are carried here explicitly so the test stays green
// without hiding a NEW gap (see the story's Dev Notes -> Out of scope).
const PRE_EXISTING_GAPS = new Set([
  'action-timeout-error',
  'invalid-action-input-error',
]);

const REF_PATTERN =
  /https:\/\/thymian\.dev\/references\/errors\/([a-z0-9-]+)\//g;

const PACKAGES_ROOT = join(__dirname, '../../packages');
const ERRORS_DIR = join(__dirname, '../src/content/docs/references/Errors');

function walkTsFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') {
      continue;
    }

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walkTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function findReferencedSlugs(): Set<string> {
  const slugs = new Set<string>();

  for (const file of walkTsFiles(PACKAGES_ROOT)) {
    const content = readFileSync(file, 'utf-8');

    for (const match of content.matchAll(REF_PATTERN)) {
      slugs.add(match[1]);
    }
  }

  return slugs;
}

function existingPageSlugs(): Set<string> {
  return new Set(
    readdirSync(ERRORS_DIR)
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => entry.replace(/\.md$/, '')),
  );
}

describe('error ref pages', () => {
  it('has a references/Errors/<slug>.md page for every ref a packages/** source names', () => {
    const referenced = findReferencedSlugs();
    const pages = existingPageSlugs();

    const missing = [...referenced]
      .filter((slug) => !PRE_EXISTING_GAPS.has(slug))
      .filter((slug) => !pages.has(slug));

    expect(missing).toEqual([]);
  });

  it('names plugin-load-error and user-module-load-error, so this test goes red if either page is removed', () => {
    const referenced = findReferencedSlugs();

    expect(referenced.has('plugin-load-error')).toBe(true);
    expect(referenced.has('user-module-load-error')).toBe(true);
  });
});
