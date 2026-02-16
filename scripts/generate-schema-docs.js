import { dirname, join } from 'node:path';

import { mkdir, writeFile } from 'fs/promises';
import * as jsonSchema from 'jsonschema2mk';

// e.g. @thymian/http-linter
const [pkgName, targetMd] = process.argv.slice(2);

console.log('Generating JSON schema docs for', pkgName);

if (!pkgName) {
  console.error('Please provide a package name. E.g. @thymian/http-linter');
  process.exit(1);
}

try {
  const plugin = await import(pkgName);
  const options = plugin.default['options'];

  if (!options) {
    console.warn('No options found in plugin, skipping schema generation.');
  } else {
    const jsm = new jsonSchema.default({
      partials: ['json2md-partials'],
      extension: ['front-matter'],
      plugin: [join(import.meta.dirname, 'jsonschema2mk', 'nobr-in-table.cjs')],
      fm: {
        title: options['title'] ?? 'Plugin Options',
        description: options['description'] ?? '',
        sidebar: {
          order: -100,
        },
      },
    });
    const md = await jsm.convert(options);
    await mkdir(dirname(targetMd), { recursive: true });
    await writeFile(targetMd, md);

    console.log('Generated schema docs for', pkgName);
  }
} catch (error) {
  console.error('Failed to generate schema docs for', pkgName);
  console.error(error);
  process.exit(1);
}
