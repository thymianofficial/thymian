import * as fs from 'node:fs';
import { join } from 'node:path';
import * as readline from 'node:readline';

import { glob } from 'tinyglobby';

/**
 * Search for OpenAPI/Swagger specification files in the given directory.
 *
 * Scans all `.json`, `.yaml`, and `.yml` files and checks the first lines
 * for a `swagger` or `openapi` version header.
 */
export async function searchForOpenApiFiles(cwd: string): Promise<string[]> {
  const found: string[] = [];

  const matches = await glob('**/*.{json,yaml,yml}', {
    cwd,
  });

  for (const match of matches) {
    const filePath = join(cwd, match);

    let fileStream: fs.ReadStream | null = null;
    let rl: readline.Interface | null = null;

    try {
      fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });

      rl = readline.createInterface({
        input: fileStream,
      });

      for await (const line of rl) {
        if (
          /^\s*"?swagger"?\s*:\s*"?2\.0(?:\.0)?"?\s*$/i.test(line) ||
          /^\s*"?openapi"?\s*:\s*"?3\.[01]\.\d+"?\s*$/i.test(line)
        ) {
          found.push(match);
          break;
        }
      }
    } finally {
      if (rl) {
        rl.close();
      }
      if (fileStream) {
        fileStream.destroy();
      }
    }
  }

  return found;
}
