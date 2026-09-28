const MAX_NEAR_PATHS = 5;

/**
 * Paths that share `value`'s longest literal prefix, as message lines.
 *
 * Walks the prefix from the longest down to the shortest, so the reader is
 * pointed at the narrowest subtree that actually has anything in it rather
 * than at the whole description. No fuzzy matching: it would add a
 * dependency and make the ordering unexplainable.
 *
 * Shared between a vacuous filter path value and a Selector whose path is a
 * typo — the same prefix walk, so the two diagnostics agree on what "near"
 * means instead of carrying two guesses that could disagree.
 */
export function nearestPathHints(
  value: string,
  paths: readonly string[],
): string[] {
  const segments = value.split('/');

  for (let depth = segments.length - 1; depth > 0; depth--) {
    const prefix = `${segments.slice(0, depth).join('/')}/`;
    const candidates = paths
      .filter((path) => path.startsWith(prefix))
      .slice(0, MAX_NEAR_PATHS);

    if (candidates.length > 0) {
      return [
        `Paths under "${prefix}" are:`,
        ...candidates.map((path) => `"${path}"`),
      ];
    }
  }

  return [
    `No path in the loaded API description begins with "${segments[1] ? `/${segments[1]}` : value}".`,
  ];
}
