import { parseArgs } from 'node:util';

import { getConfig } from './get-config.js';

export async function getPluginNames(
  args: string[] = process.argv.slice(2),
): Promise<string[]> {
  const options = {
    config: {
      type: 'string',
      short: 'c',
    },
  } as const;

  const processed = parseArgs({
    options,
    strict: false,
    args,
    allowPositionals: true,
  });

  const configFlag = processed.values.config;

  const config = await getConfig({
    configPath: typeof configFlag === 'string' ? configFlag : undefined,
    cwd: process.cwd(),
  });

  return Object.keys(config.plugins);
}
