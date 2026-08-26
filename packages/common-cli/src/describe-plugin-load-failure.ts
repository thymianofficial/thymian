import { isRecord } from '@thymian/core';

export interface PluginLoadFailureDescription {
  reason: string;
  suggestions: string[];
}

// A load-time failure means the module already resolved and began executing,
// so export-shape advice (which belongs to the missing-default / not-a-plugin
// branches in the loader) would misdirect here. This suggestion points at the
// things that actually break a load: the module's own imports, or invalid
// source. (epic #725 §6.)
const GENERIC_SUGGESTIONS = [
  "The plugin threw while loading — check the underlying message above, that the plugin's own imports resolve, and that it is valid TypeScript/JavaScript.",
];

/**
 * Derives a human-readable reason (and suggestions) from an error caught
 * while loading a plugin module, so `PluginLoadError` can name the real
 * cause without `--debug` (epic #725 §6). Keyed on `error.code` where one
 * is present; always returns a non-empty reason, even for an error with no
 * code and no message (e.g. a non-Error value thrown by the plugin).
 */
export function describePluginLoadFailure(
  error: unknown,
): PluginLoadFailureDescription {
  const code = getErrorCode(error);

  if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
    return {
      reason: `a module it imports could not be found (${describeError(error)})`,
      suggestions: [
        'Check that every import inside the plugin resolves — a missing dependency, or a typo in a relative import path.',
      ],
    };
  }

  return {
    reason: describeError(error),
    suggestions: GENERIC_SUGGESTIONS,
  };
}

// jiti and Node's ESM loader often WRAP the underlying failure, leaving the
// real `code` (e.g. MODULE_NOT_FOUND) on `error.cause` while the outer error
// carries a generic message and no code. Walk the cause chain so a wrapped
// module-not-found still selects the import-specific branch above. (§6.)
function getErrorCode(error: unknown): string | undefined {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && isRecord(current); depth += 1) {
    if (typeof current.code === 'string') {
      return current.code;
    }

    current = current.cause;
  }

  return undefined;
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return 'an unknown error occurred while loading the plugin';
}
