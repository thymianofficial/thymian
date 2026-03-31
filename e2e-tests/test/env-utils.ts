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
  return env;
}
