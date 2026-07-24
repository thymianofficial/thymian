import { type SchemaContext, z } from 'astro:content';
import { describe, expect, it } from 'vitest';

import { attributionSchema } from '../src/schema/attribution';
import { eventsSchema } from '../src/schema/events';
import { TEAM_KEYS } from '../src/schema/team-keys';

// `eventsSchema` is now a `SchemaContext` factory so its optional `logo` field
// can use the content-collection `image()` helper. Tests never supply `logo`,
// so `.optional()` short-circuits and this fake is never invoked at runtime; it
// only has to type-check (tsconfig `include: ["**/*"]` type-checks test/ too).
const image = (() =>
  z.object({
    src: z.string(),
    width: z.number(),
    height: z.number(),
    format: z.string(),
  })) as unknown as SchemaContext['image'];

const schema = eventsSchema({ image });

const aTeamKey = TEAM_KEYS[0] as string;
const anotherTeamKey = (TEAM_KEYS[1] ?? TEAM_KEYS[0]) as string;

const baseEvent = {
  title: 'Some Event',
  participation: 'talk' as const,
  mode: 'presenting' as const,
  location: 'Munich, Germany',
  date: { precision: 'exact' as const, date: '2026-09-15' },
};

describe('attributionSchema', () => {
  it('accepts a guest with externalHost + platform and no URL', () => {
    const r = attributionSchema.safeParse({
      hostGuest: 'guest',
      externalHost: 'My Coding Zone',
      platform: 'YouTube',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a guest missing externalHost/platform', () => {
    expect(attributionSchema.safeParse({ hostGuest: 'guest' }).success).toBe(
      false,
    );
  });

  it('rejects a guest with empty-string externalHost/platform', () => {
    const r = attributionSchema.safeParse({
      hostGuest: 'guest',
      externalHost: '   ',
      platform: '',
    });
    expect(r.success).toBe(false);
  });

  it('accepts a bare host', () => {
    expect(attributionSchema.safeParse({ hostGuest: 'host' }).success).toBe(
      true,
    );
  });

  it('rejects a host that carries external-host data (AD-13)', () => {
    const r = attributionSchema.safeParse({
      hostGuest: 'host',
      externalHost: 'Someone Else',
    });
    expect(r.success).toBe(false);
  });
});

describe('eventsSchema — speakers', () => {
  it('accepts an empty speakers array (booth case)', () => {
    const r = schema.safeParse({
      ...baseEvent,
      participation: 'booth',
      mode: 'attending',
      location: undefined,
      online: true,
      date: { precision: 'tba' },
      speakers: [],
    });
    expect(r.success).toBe(true);
  });

  it('accepts known team keys', () => {
    const r = schema.safeParse({ ...baseEvent, speakers: [aTeamKey] });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown speaker key on the speakers path', () => {
    const r = schema.safeParse({
      ...baseEvent,
      speakers: ['nobodyHere'],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('speakers'))).toBe(
        true,
      );
    }
  });

  it('rejects duplicate speaker keys', () => {
    const r = schema.safeParse({
      ...baseEvent,
      speakers: [aTeamKey, aTeamKey],
    });
    expect(r.success).toBe(false);
  });

  it('accepts two distinct known speakers', () => {
    const r = schema.safeParse({
      ...baseEvent,
      speakers: [aTeamKey, anotherTeamKey],
    });
    expect(r.success).toBe(anotherTeamKey !== aTeamKey);
  });
});

describe('eventsSchema — place XOR', () => {
  it('accepts a physical-only event', () => {
    const r = schema.safeParse({ ...baseEvent, location: 'Munich' });
    expect(r.success).toBe(true);
  });

  it('accepts an online-only event', () => {
    const r = schema.safeParse({
      ...baseEvent,
      location: undefined,
      online: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects both physical and online', () => {
    const r = schema.safeParse({
      ...baseEvent,
      location: 'Munich',
      online: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects neither physical nor online', () => {
    const r = schema.safeParse({ ...baseEvent, location: undefined });
    expect(r.success).toBe(false);
  });
});

describe('eventsSchema — participation type', () => {
  it('rejects a participation type outside the enum', () => {
    const r = schema.safeParse({
      ...baseEvent,
      participation: 'keynote',
    });
    expect(r.success).toBe(false);
  });
});

describe('eventsSchema — register/resource links', () => {
  it('accepts an event with no link fields (both optional)', () => {
    expect(schema.safeParse(baseEvent).success).toBe(true);
  });

  it('accepts valid register + resource URLs', () => {
    const r = schema.safeParse({
      ...baseEvent,
      registerUrl: 'https://example.com/signup',
      resourceUrl: 'https://example.com/recording',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a non-URL registerUrl (build-time validation)', () => {
    const r = schema.safeParse({
      ...baseEvent,
      registerUrl: 'not a url',
    });
    expect(r.success).toBe(false);
  });

  it('rejects a non-URL resourceUrl (build-time validation)', () => {
    const r = schema.safeParse({
      ...baseEvent,
      resourceUrl: 'not a url',
    });
    expect(r.success).toBe(false);
  });
});

describe('eventsSchema — logo (optional, build-safe)', () => {
  it('accepts an event with no logo (logo is optional)', () => {
    const r = schema.safeParse(baseEvent);
    expect(r.success).toBe(true);
  });
});
