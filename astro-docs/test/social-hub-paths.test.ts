import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';

import {
  hubParamsForEntry,
  hubPathForEntry,
} from '../src/components/social/socialHubPaths';

// Fake entries — mirror the `test/cross-links.test.ts` idiom (minimal object
// literals cast `as unknown as CollectionEntry<...>`). No content fixtures,
// no clock reads.
type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

function event(id: string): EventEntry {
  return {
    id,
    collection: 'events',
    data: { title: id },
  } as unknown as EventEntry;
}

function resource(id: string): ResourceEntry {
  return {
    id,
    collection: 'resources',
    data: { title: id },
  } as unknown as ResourceEntry;
}

describe('hubParamsForEntry', () => {
  it('returns { collection: "events", entry: id } for an event', () => {
    expect(hubParamsForEntry(event('froscon-community-booth'))).toEqual({
      collection: 'events',
      entry: 'froscon-community-booth',
    });
  });

  it('returns { collection: "resources", entry: id } for a resource', () => {
    expect(
      hubParamsForEntry(resource('should-i-get-or-should-i-post-recording')),
    ).toEqual({
      collection: 'resources',
      entry: 'should-i-get-or-should-i-post-recording',
    });
  });
});

describe('hubPathForEntry', () => {
  it('builds the events path with a trailing slash', () => {
    expect(hubPathForEntry(event('froscon-community-booth'))).toBe(
      '/social/events-resources/events/froscon-community-booth/',
    );
  });

  it('builds the resources path with a trailing slash', () => {
    expect(
      hubPathForEntry(resource('should-i-get-or-should-i-post-recording')),
    ).toBe(
      '/social/events-resources/resources/should-i-get-or-should-i-post-recording/',
    );
  });

  it('never emits a "#" fragment', () => {
    expect(hubPathForEntry(event('e'))).not.toContain('#');
    expect(hubPathForEntry(resource('r'))).not.toContain('#');
  });

  it('disambiguates the same id across both collections via the collection segment', () => {
    const sameId = 'shared-slug';
    const eventPath = hubPathForEntry(event(sameId));
    const resourcePath = hubPathForEntry(resource(sameId));

    expect(eventPath).toBe('/social/events-resources/events/shared-slug/');
    expect(resourcePath).toBe(
      '/social/events-resources/resources/shared-slug/',
    );
    expect(eventPath).not.toBe(resourcePath);
  });
});

describe('module purity', () => {
  it('is deterministic across repeat calls — no clock, no getCollection, no Astro.* read', () => {
    const e = event('same');
    const r = resource('same');
    expect(hubParamsForEntry(e)).toEqual(hubParamsForEntry(e));
    expect(hubPathForEntry(e)).toBe(hubPathForEntry(e));
    expect(hubParamsForEntry(r)).toEqual(hubParamsForEntry(r));
    expect(hubPathForEntry(r)).toBe(hubPathForEntry(r));
  });
});
