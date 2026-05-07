import { dirname, join } from 'node:path';

import { mkdir, writeFile } from 'fs/promises';
import * as jsonSchema from 'jsonschema2mk';

const [targetMd] = process.argv.slice(2);

if (!targetMd) {
  console.error('Usage: node generate-config-schema-docs.js <target-md-path>');
  process.exit(1);
}

console.log('Generating config schema docs');

try {
  const { thymianConfigSchema } = await import('@thymian/common-cli');

  const jsm = new jsonSchema.default({
    partials: ['json2md-partials'],
    extension: ['front-matter'],
    plugin: [join(import.meta.dirname, 'jsonschema2mk', 'nobr-in-table.cjs')],
    fm: {
      title: 'Configuration Schema',
      description: 'Auto-generated from the Thymian config JSON schema.',
    },
  });

  const md = await jsm.convert(thymianConfigSchema);
  await mkdir(dirname(targetMd), { recursive: true });
  await writeFile(targetMd, md);

  console.log('Generated config schema docs at', targetMd);
} catch (error) {
  console.error('Failed to generate config schema docs');
  console.error(error);
  process.exit(1);
}
