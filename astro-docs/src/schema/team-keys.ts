import { blogAuthors } from '../data/team';

/**
 * Valid speaker keys, derived from the team data module (never hand-duplicated).
 * These are the camelCase keys of `blogAuthors` (founders + contributors).
 */
export const TEAM_KEYS = Object.keys(blogAuthors);

const teamKeySet = new Set(TEAM_KEYS);

export { teamKeySet };

/** True when `k` is a known team (speaker) key. */
export function isTeamKey(k: string): boolean {
  return teamKeySet.has(k);
}
