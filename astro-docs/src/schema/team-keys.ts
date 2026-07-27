import { blogAuthors } from '../data/team';

/**
 * Valid speaker keys, derived from the team data module (never hand-duplicated).
 * These are the camelCase keys of `blogAuthors` (founders + contributors).
 * Frozen so no consumer can mutate it away from the validation set below.
 */
export const TEAM_KEYS: readonly string[] = Object.freeze(
  Object.keys(blogAuthors),
);

const teamKeySet = new Set(TEAM_KEYS);

/** True when `k` is a known team (speaker) key. */
export function isTeamKey(k: string): boolean {
  return teamKeySet.has(k);
}
