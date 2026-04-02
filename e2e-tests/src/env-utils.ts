export function getCleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) {
      continue;
    }
    if (key.startsWith('NX_')) {
      continue;
    }
    if (key === 'NODE_PATH') {
      continue;
    }
    if (key === 'JEST_WORKER_ID') {
      continue;
    }
    env[key] = value;
  }
  env['FORCE_COLOR'] = '0';

  // Force production mode so that oclif's ts-path.js does NOT attempt to
  // remap the compiled `dist/commands` directory back to the `src/commands`
  // source path.  The published npm package only ships `dist/`, so the
  // remap causes "X is not a thymian command" errors when NODE_ENV is
  // "test" or "development".
  env['NODE_ENV'] = 'production';

  return env;
}
