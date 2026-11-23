import {
  type CachedError,
  ERROR_RECORD_VERSION,
} from '../../src/error-cache.js';

/**
 * A current-version error record with plain defaults. A test overrides only
 * the fields it is about; the merge is shallow, so an override of `version`
 * replaces the whole object.
 */
export function aCachedError(
  overrides: Partial<CachedError> = {},
): CachedError {
  return {
    recordVersion: ERROR_RECORD_VERSION,
    name: 'TestError',
    message: 'Test',
    commandName: 'test',
    timestamp: 1234567890000,
    argv: [],
    version: {
      architecture: 'x64',
      cliVersion: '1.0.0',
      nodeVersion: 'v18.0.0',
    },
    pluginVersions: [],
    ...overrides,
  };
}
