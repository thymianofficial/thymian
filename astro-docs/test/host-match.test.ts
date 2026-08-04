import { describe, expect, it } from 'vitest';

import { isHost } from '../src/components/hostMatch';

/**
 * `isHost` is now a SHARED security boundary (event resource labels + resource
 * embed derivation both depend on it), so its invariant is pinned directly here
 * rather than only transitively through the resolvers.
 */
describe('isHost (shared host-boundary check)', () => {
  it('matches the exact domain', () => {
    expect(isHost('youtube.com', 'youtube.com')).toBe(true);
  });

  it('matches a real subdomain', () => {
    expect(isHost('www.youtube.com', 'youtube.com')).toBe(true);
    expect(isHost('open.spotify.com', 'spotify.com')).toBe(true);
  });

  it('rejects a prefix look-alike (the evildomain.com pitfall)', () => {
    expect(isHost('evilyoutube.com', 'youtube.com')).toBe(false);
    expect(isHost('notspotify.com', 'spotify.com')).toBe(false);
  });

  it('rejects a suffix spoof (the domain as a left-hand label)', () => {
    expect(isHost('youtube.com.evil.com', 'youtube.com')).toBe(false);
  });

  it('rejects an unrelated domain', () => {
    expect(isHost('example.com', 'youtube.com')).toBe(false);
  });
});
