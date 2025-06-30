import { parseArgs } from 'node:util';

import { getConfig } from './get-config.js';

export async function getPluginNames(
  args: string[] = process.argv.slice(2)
): Promise<string[]> {
  const options = {
    config: {
      type: 'string',
      short: 'c',
      default: 'thymian.config.json',
    },
  } as const;

  const processed = parseArgs({
    options,
    strict: false,
    args,
    allowPositionals: true,
  });

  const configFlag = processed.values.config;

  const configPath =
    typeof configFlag === 'string' ? configFlag : 'thymian.config.yaml';

  const config = await getConfig(configPath, process.cwd());

  return Object.keys(config.plugins);
}
