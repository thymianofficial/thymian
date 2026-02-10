import { writeFile } from 'fs/promises';
import * as jsonSchema from 'jsonschema2mk';

// e.g. @thymian/http-linter
const [pkgName, targetMd] = process.argv.slice(2);

console.log('Generating JSON schema docs for', pkgName);

if (!pkgName) {
  console.error('Please provide a package name. E.g. @thymian/http-linter');
  process.exit(1);
}

import(pkgName)
  .then((plugin) => plugin.default['options'])
  .then((options) => {
    if (!options) {
      throw new Error('No options found in plugin');
    }
    const jsm = new jsonSchema.default({
      partials: ['json2md-partials'],
      extension: ['front-matter'],
      fm: {
        title: options['title'] ?? 'Plugin Options',
        description: options['description'] ?? '',
        sidebar: {
          order: -100,
        },
      },
    });
    return jsm.convert(options);
  })
  .then((md) => writeFile(targetMd, md))
  .catch((error) => console.error(error))
  .finally(() => {
    console.log('Done!');
  });
