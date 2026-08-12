import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';

import { indexEventsById } from '../src/lib/cross-links';
import {
  type PromoImageResult,
  resolvePromoImage,
} from '../src/lib/promo-image';
import type { Attribution } from '../src/schema/attribution';
import type { EventDate } from '../src/schema/event-date';
import type {
  ParticipationMode,
  ParticipationType,
} from '../src/schema/events';
import type { ResourceType } from '../src/schema/resources';

// Fake entries — mirror the `test/cross-links.test.ts` idiom (minimal object
// literals cast `as unknown as CollectionEntry<...>`), extended with the
// fields this resolver actually reads (`logo`, `participation`, `mode`,
// `location`/`online`, `attribution` for events; `resourceType`,
// `attribution` for resources). No content fixtures.

type EventEntry = CollectionEntry<'events'>;
type ResourceEntry = CollectionEntry<'resources'>;

/** A resolved-logo fake, never a real imported asset (per Dev Notes). */
function fakeLogo(src = '/logo.png'): ImageMetadata {
  return {
    src,
    width: 200,
    height: 100,
    format: 'png',
  } as unknown as ImageMetadata;
}

interface EventOverrides {
  title?: string;
  date?: EventDate;
  participation?: ParticipationType;
  mode?: ParticipationMode;
  location?: string;
  online?: boolean;
  attribution?: Attribution;
  logo?: ImageMetadata;
}

function event(id: string, overrides: EventOverrides = {}): EventEntry {
  const {
    title = id,
    date = { precision: 'exact', date: new Date('2026-07-08') },
    participation = 'talk',
    mode = 'presenting',
    location,
    online,
    attribution,
    logo,
  } = overrides;
  return {
    id,
    collection: 'events',
    data: {
      title,
      date,
      participation,
      mode,
      location,
      online,
      attribution,
      logo,
    },
  } as unknown as EventEntry;
}

interface ResourceOverrides {
  title?: string;
  resourceType?: ResourceType;
  attribution?: Attribution;
  originEventId?: string;
}

function resource(
  id: string,
  overrides: ResourceOverrides = {},
): ResourceEntry {
  const {
    title = id,
    resourceType = 'recorded talk',
    attribution,
    originEventId,
  } = overrides;
  return {
    id,
    collection: 'resources',
    data: {
      title,
      resourceType,
      attribution,
      originEvent:
        originEventId === undefined
          ? undefined
          : { collection: 'events', id: originEventId },
    },
  } as unknown as ResourceEntry;
}

const guestAttribution: Attribution = {
  hostGuest: 'guest',
  externalHost: 'My Coding Zone',
  platform: 'YouTube',
};

const hostAttribution: Attribution = { hostGuest: 'host' };

/** Narrow a `PromoImageResult` to its `logo` branch or fail the test loudly. */
function asLogo(
  result: PromoImageResult,
): Extract<PromoImageResult, { kind: 'logo' }> {
  if (result.kind !== 'logo') {
    throw new Error(`expected kind: 'logo', got kind: '${result.kind}'`);
  }
  return result;
}

describe('resolvePromoImage — contract (AC1/AC6)', () => {
  it('takes exactly two parameters — no platform, not even optional', () => {
    expect(resolvePromoImage).toHaveLength(2);
  });
});

describe('resolvePromoImage — Event logo branch (AC2)', () => {
  it('returns kind: logo with the unmodified image and "<title> logo" alt', () => {
    const logo = fakeLogo();
    const ev = event('apidays', { title: 'apidays Munich', logo });
    const result = asLogo(resolvePromoImage(ev, indexEventsById([ev])));
    // Reference-identical, not deep-equal (AC6/AC8) — `toBe`, never `toEqual`.
    expect(result.image).toBe(logo);
    expect(result.brand).toBe('apidays Munich');
    expect(result.alt).toBe('apidays Munich logo');
  });

  it('a Guest event derives brand/alt from externalHost, not title', () => {
    const logo = fakeLogo();
    const ev = event('mcz', {
      title: 'Should I GET or Should I POST',
      attribution: guestAttribution,
      online: true,
      logo,
    });
    const result = asLogo(resolvePromoImage(ev, indexEventsById([ev])));
    expect(result.brand).toBe('My Coding Zone');
    expect(result.alt).toBe('My Coding Zone logo');
  });
});

describe('resolvePromoImage — Event card branch (AC5)', () => {
  it('returns kind: card with headline = title and the exact subheadline', () => {
    const ev = event('apidays', {
      title: 'apidays Munich',
      location: 'Munich',
      date: { precision: 'exact', date: new Date('2026-07-08') },
    });
    const result = resolvePromoImage(ev, indexEventsById([ev]));
    expect(result).toEqual({
      kind: 'card',
      headline: 'apidays Munich',
      subheadline: 'Talk · July 8, 2026 · Munich',
    });
  });

  it('an online event with no location resolves place to "Online"', () => {
    const ev = event('mcz', {
      title: 'Livestream',
      participation: 'livestream',
      online: true,
      date: { precision: 'exact', date: new Date('2026-07-10') },
    });
    const result = resolvePromoImage(ev, indexEventsById([ev]));
    expect(result).toEqual({
      kind: 'card',
      headline: 'Livestream',
      subheadline: 'Livestream · July 10, 2026 · Online',
    });
  });

  it('a TBA-date event yields "Date TBA" verbatim, filtered like any other fragment', () => {
    const ev = event('future', {
      title: 'Future Talk',
      location: 'Berlin',
      date: { precision: 'tba' },
    });
    const result = resolvePromoImage(ev, indexEventsById([ev]));
    expect(result).toEqual({
      kind: 'card',
      headline: 'Future Talk',
      subheadline: 'Talk · Date TBA · Berlin',
    });
  });

  it('filters an empty place fragment without a doubled or trailing separator', () => {
    // Not a schema-valid combination (the `.refine` requires physical XOR
    // online) — but the resolver reads through `astro:content` types, not
    // the runtime validator, so it must stay defensive under strict TS
    // regardless of whether the content author violated the refine.
    const ev = event('placeless', {
      title: 'Placeless',
      date: { precision: 'exact', date: new Date('2026-09-15') },
    });
    const result = resolvePromoImage(ev, indexEventsById([ev]));
    expect(result).toEqual({
      kind: 'card',
      headline: 'Placeless',
      subheadline: 'Talk · September 15, 2026',
    });
  });
});

describe('resolvePromoImage — Resource logo inheritance (AC3)', () => {
  it('a Resource whose Origin Event has a logo inherits kind: logo', () => {
    const logo = fakeLogo();
    const originEvent = event('mcz', {
      title: 'MCZ Livestream',
      attribution: guestAttribution,
      logo,
    });
    const eventsById = indexEventsById([originEvent]);
    const res = resource('recording', { originEventId: 'mcz' });
    const result = asLogo(resolvePromoImage(res, eventsById));
    // Reference-identical to the ORIGIN EVENT's logo, never re-derived.
    expect(result.image).toBe(logo);
    expect(result.brand).toBe('My Coding Zone');
  });
});

describe('resolvePromoImage — Resource card branch (AC3/AC5)', () => {
  it('Origin Event has no logo → card, guest subheadline mirrors ResourceAttribution wording', () => {
    const originEvent = event('mcz', {
      title: 'MCZ Livestream',
      attribution: guestAttribution,
    });
    const eventsById = indexEventsById([originEvent]);
    const res = resource('recording', {
      title: 'Should I GET or Should I POST',
      resourceType: 'recorded talk',
      attribution: guestAttribution,
      originEventId: 'mcz',
    });
    const result = resolvePromoImage(res, eventsById);
    expect(result).toEqual({
      kind: 'card',
      headline: 'Should I GET or Should I POST',
      subheadline: 'Recorded Talk · Guest of My Coding Zone on YouTube',
    });
  });

  it('a Host resource omits the guest fragment entirely — no separator, no trailer', () => {
    const originEvent = event('conf', {
      title: 'Conf',
      attribution: hostAttribution,
    });
    const eventsById = indexEventsById([originEvent]);
    const res = resource('paper', {
      title: 'The Paper',
      resourceType: 'paper',
      attribution: hostAttribution,
      originEventId: 'conf',
    });
    const result = resolvePromoImage(res, eventsById);
    expect(result).toEqual({
      kind: 'card',
      headline: 'The Paper',
      subheadline: 'Paper',
    });
  });

  it('a Resource with no originEvent at all resolves to card (FR-17 fallback)', () => {
    const res = resource('standalone', {
      title: 'Standalone Paper',
      resourceType: 'paper',
      attribution: hostAttribution,
    });
    const result = resolvePromoImage(res, indexEventsById([]));
    expect(result).toEqual({
      kind: 'card',
      headline: 'Standalone Paper',
      subheadline: 'Paper',
    });
  });
});

describe('resolvePromoImage — AD-6 dangling originEvent (AC4)', () => {
  it('throws, with AD-6 in the message, and never falls back to a card', () => {
    const res = resource('ghost-resource', {
      title: 'Ghost',
      originEventId: 'no-such-event',
    });
    expect(() => resolvePromoImage(res, indexEventsById([]))).toThrow(/AD-6/);
  });
});

describe('resolvePromoImage — licence credit (AC7)', () => {
  it('the FrosCon event with a logo carries the CC BY-ND credit', () => {
    const logo = fakeLogo();
    const froscon = event('froscon-community-booth', {
      title: 'FrosCon: Community Booth',
      participation: 'booth',
      mode: 'attending',
      location: 'Sankt Augustin',
      logo,
    });
    const result = asLogo(
      resolvePromoImage(froscon, indexEventsById([froscon])),
    );
    expect(result.credit?.licenseName).toBe('CC BY-ND 3.0 DE');
  });

  it('the same FrosCon entry WITHOUT a logo carries no credit (text fallback obliges nothing)', () => {
    const froscon = event('froscon-community-booth', {
      title: 'FrosCon: Community Booth',
      participation: 'booth',
      mode: 'attending',
      location: 'Sankt Augustin',
    });
    const result = resolvePromoImage(froscon, indexEventsById([froscon]));
    expect(result.kind).toBe('card');
    expect((result as { credit?: unknown }).credit).toBeUndefined();
  });

  it('an unregistered event with a logo carries credit === undefined, never []', () => {
    const logo = fakeLogo();
    const ev = event('frankenjs-spice-up-your-api', {
      title: 'FrankenJS',
      logo,
    });
    const result = asLogo(resolvePromoImage(ev, indexEventsById([ev])));
    expect(result.credit).toBeUndefined();
  });

  it('a Resource inheriting the FrosCon logo resolves credit off the Origin Event id, not the resource id', () => {
    const logo = fakeLogo();
    const froscon = event('froscon-community-booth', {
      title: 'FrosCon: Community Booth',
      participation: 'booth',
      mode: 'attending',
      location: 'Sankt Augustin',
      logo,
    });
    const eventsById = indexEventsById([froscon]);
    const res = resource('froscon-recap', {
      title: 'FrosCon recap',
      originEventId: 'froscon-community-booth',
    });
    const result = asLogo(resolvePromoImage(res, eventsById));
    expect(result.credit?.licenseName).toBe('CC BY-ND 3.0 DE');
  });
});
