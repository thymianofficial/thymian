import { describe, expect, it } from 'vitest';

import {
  compareResources,
  resolveGuestAttribution,
  resourceTypeFromSlug,
  resourceTypeSlug,
  type SortableResource,
} from '../src/components/resources/resourceMeta';
import { type Attribution } from '../src/schema/attribution';

const res = (title: string, date?: Date): SortableResource => ({ title, date });

describe('compareResources', () => {
  it('sorts descending by date (most recent first)', () => {
    const sorted = [
      res('January', new Date('2026-01-01')),
      res('June', new Date('2026-06-01')),
      res('March', new Date('2026-03-01')),
    ].sort(compareResources);
    expect(sorted.map((r) => r.title)).toEqual(['June', 'March', 'January']);
  });

  it('buckets undated entries last', () => {
    const sorted = [
      res('Undated'),
      res('Dated', new Date('2026-05-01')),
    ].sort(compareResources);
    expect(sorted.map((r) => r.title)).toEqual(['Dated', 'Undated']);
  });

  it('breaks same-date ties by title A→Z', () => {
    const sorted = [
      res('Zeta', new Date('2026-05-01')),
      res('Alpha', new Date('2026-05-01')),
      res('Mike', new Date('2026-05-01')),
    ].sort(compareResources);
    expect(sorted.map((r) => r.title)).toEqual(['Alpha', 'Mike', 'Zeta']);
  });

  it('orders wholly-undated entries by title A→Z (the shipped basis)', () => {
    const sorted = [res('Zeta'), res('Alpha'), res('Mike')].sort(
      compareResources,
    );
    expect(sorted.map((r) => r.title)).toEqual(['Alpha', 'Mike', 'Zeta']);
  });

  it('treats an Invalid Date as undated (no NaN comparator result)', () => {
    const sorted = [
      res('Invalid', new Date('not-a-date')),
      res('Dated', new Date('2026-05-01')),
    ].sort(compareResources);
    // Invalid-date entry buckets last, exactly like an omitted date.
    expect(sorted.map((r) => r.title)).toEqual(['Dated', 'Invalid']);
  });
});

describe('resourceTypeSlug / resourceTypeFromSlug', () => {
  it('round-trips multi-word types through URL-safe slugs', () => {
    expect(resourceTypeSlug('recorded talk')).toBe('recorded-talk');
    expect(resourceTypeSlug('podcast episode')).toBe('podcast-episode');
    expect(resourceTypeFromSlug('recorded-talk')).toBe('recorded talk');
    expect(resourceTypeFromSlug('podcast-episode')).toBe('podcast episode');
  });

  it('round-trips single-word types unchanged', () => {
    expect(resourceTypeSlug('webinar')).toBe('webinar');
    expect(resourceTypeSlug('paper')).toBe('paper');
    expect(resourceTypeFromSlug('webinar')).toBe('webinar');
    expect(resourceTypeFromSlug('paper')).toBe('paper');
  });

  it('returns undefined for an unknown slug', () => {
    expect(resourceTypeFromSlug('recorded talk')).toBeUndefined();
    expect(resourceTypeFromSlug('nope')).toBeUndefined();
    expect(resourceTypeFromSlug('')).toBeUndefined();
  });
});

describe('resolveGuestAttribution (re-exported, AD-13 honest attribution)', () => {
  const guest: Attribution = {
    hostGuest: 'guest',
    externalHost: 'My Coding Zone',
    platform: 'YouTube',
    externalUrl: 'https://youtube.com/mycodingzone',
  };

  it('returns null for an absent attribution', () => {
    expect(resolveGuestAttribution(undefined)).toBeNull();
  });

  it('returns null for a host resource (no external host to credit)', () => {
    expect(resolveGuestAttribution({ hostGuest: 'host' })).toBeNull();
  });

  it('returns the attribution for a valid guest', () => {
    expect(resolveGuestAttribution(guest)).toEqual(guest);
  });

  it('returns a valid guest even without an external URL (text render)', () => {
    const noUrl: Attribution = {
      hostGuest: 'guest',
      externalHost: 'FrankenJS',
      platform: 'Meetup',
    };
    expect(resolveGuestAttribution(noUrl)).toEqual(noUrl);
  });

  it('returns null for a guest with an empty host', () => {
    expect(
      resolveGuestAttribution({
        hostGuest: 'guest',
        externalHost: '   ',
        platform: 'YouTube',
      }),
    ).toBeNull();
  });

  it('returns a normalized copy for whitespace-padded guest fields', () => {
    expect(
      resolveGuestAttribution({
        hostGuest: 'guest',
        externalHost: '  My Coding Zone  ',
        platform: '  YouTube  ',
        externalUrl: '  https://youtube.com/mycodingzone  ',
      }),
    ).toEqual({
      hostGuest: 'guest',
      externalHost: 'My Coding Zone',
      platform: 'YouTube',
      externalUrl: 'https://youtube.com/mycodingzone',
    });
  });
});
